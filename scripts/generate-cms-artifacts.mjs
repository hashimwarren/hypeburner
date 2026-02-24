#!/usr/bin/env node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { build } from 'esbuild'
import { config as loadDotenv } from 'dotenv'
import { slug } from 'github-slugger'
import readingTime from 'reading-time'
import siteMetadata from '../data/siteMetadata.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadDotenv({ path: path.resolve(rootDir, '.env.local') })
loadDotenv({ path: path.resolve(rootDir, '.env') })
const outputFolder = process.env.EXPORT ? 'out' : 'public'
const POSTS_COLLECTION = process.env.PAYLOAD_POSTS_COLLECTION?.trim() || 'posts'
const queryLimitValue = Number(process.env.PAYLOAD_QUERY_LIMIT || '1000')
const QUERY_LIMIT = Number.isFinite(queryLimitValue) && queryLimitValue > 0 ? queryLimitValue : 1000

function normalizeTags(value) {
  if (!Array.isArray(value)) return []
  return value.map((tag) => String(tag || '').trim()).filter(Boolean)
}

function normalizeImages(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

function normalizeFilePath(value, slugValue) {
  const raw = String(value || '').trim()
  if (!raw) return `blog/${slugValue}.mdx`
  return raw.replace(/^data\//, '')
}

function normalizePost(doc) {
  const slugValue = String(doc?.slug || '').trim()
  const title = String(doc?.title || '').trim()
  if (!slugValue || !title) return null

  const publishedAt = String(doc?.publishedAt || doc?.createdAt || new Date().toISOString())
  const sourceMarkdown = String(doc?.sourceMarkdown || '')
  const summary = String(doc?.summary || '').trim()
  const tags = normalizeTags(doc?.tags)
  const images = normalizeImages(doc?.images)
  const structuredData =
    doc?.structuredData && typeof doc.structuredData === 'object' ? doc.structuredData : undefined

  return {
    title,
    date: publishedAt,
    tags,
    draft: false,
    summary,
    images,
    type: 'Blog',
    readingTime: readingTime(sourceMarkdown || summary || title),
    slug: slugValue,
    path: `blog/${slugValue}`,
    filePath: normalizeFilePath(doc?.legacySourcePath, slugValue),
    toc: [],
    structuredData:
      structuredData ||
      {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: title,
        datePublished: publishedAt,
        dateModified: String(doc?.lastmod || publishedAt),
        description: summary,
        image: images[0] || siteMetadata.socialBanner,
        url: `${siteMetadata.siteUrl}/blog/${slugValue}`,
      },
  }
}

function sortByDateDesc(posts) {
  return [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

async function loadPayloadConfig() {
  const tempDir = mkdtempSync(path.join(rootDir, '.tmp-payload-config-'))
  const outputPath = path.join(tempDir, 'payload.config.mjs')

  try {
    await build({
      entryPoints: [path.resolve(rootDir, 'payload.config.ts')],
      outfile: outputPath,
      bundle: true,
      packages: 'external',
      platform: 'node',
      format: 'esm',
      target: 'node20',
      sourcemap: false,
    })

    const configModule = await import(pathToFileURL(outputPath).href)
    return configModule?.default || configModule
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

async function getPayloadClient() {
  const config = await loadPayloadConfig()
  const payloadModule = await import('payload')
  return await payloadModule.getPayload({ config })
}

export async function getPublishedPosts() {
  let payloadClient
  try {
    payloadClient = await getPayloadClient()
    const result = await payloadClient.find({
      collection: POSTS_COLLECTION,
      draft: false,
      where: {
        status: {
          equals: 'published',
        },
      },
      sort: '-publishedAt',
      depth: 0,
      limit: QUERY_LIMIT,
      overrideAccess: true,
    })

    const docs = (result?.docs || []).map(normalizePost).filter(Boolean)
    return sortByDateDesc(docs)
  } finally {
    try {
      if (payloadClient && typeof payloadClient.destroy === 'function') {
        await payloadClient.destroy()
      } else if (payloadClient?.db && typeof payloadClient.db.destroy === 'function') {
        await payloadClient.db.destroy()
      }
    } catch (error) {
      console.warn('[artifacts] failed to close Payload connection cleanly', error)
    }
  }
}

function buildTagData(posts) {
  const tagCount = {}
  for (const post of posts) {
    for (const tag of post.tags || []) {
      const normalized = slug(tag)
      if (!normalized) continue
      tagCount[normalized] = (tagCount[normalized] || 0) + 1
    }
  }
  return tagCount
}

function resolveSearchPath() {
  const configuredPath = siteMetadata?.search?.kbarConfig?.searchDocumentsPath
  if (typeof configuredPath !== 'string' || configuredPath.trim().length === 0) {
    return 'search.json'
  }
  const baseName = path.basename(configuredPath)
  return baseName || 'search.json'
}

export async function generateCmsArtifacts(options = {}) {
  const posts = Array.isArray(options.posts) ? options.posts : await getPublishedPosts()
  const tagData = buildTagData(posts)
  const searchDocuments = posts

  const appPath = path.join(rootDir, 'app', 'tag-data.json')
  const publicDir = path.join(rootDir, outputFolder)
  const searchPath = path.join(publicDir, resolveSearchPath())

  mkdirSync(path.dirname(appPath), { recursive: true })
  mkdirSync(publicDir, { recursive: true })

  writeFileSync(appPath, `${JSON.stringify(tagData, null, 2)}\n`)
  writeFileSync(searchPath, JSON.stringify(searchDocuments))

  return {
    postCount: posts.length,
    tagCount: Object.keys(tagData).length,
    searchPath: path.relative(rootDir, searchPath),
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  generateCmsArtifacts()
    .then((result) => {
      console.log(
        `[artifacts] generated tag-data + search index for ${result.postCount} posts (${result.tagCount} unique tags)`
      )
      console.log(`[artifacts] wrote ${result.searchPath}`)
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
