import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { build } from 'esbuild'
import { config as loadDotenv } from 'dotenv'
import { slug } from 'github-slugger'
import { escape } from 'pliny/utils/htmlEscaper.js'
import siteMetadata from '../data/siteMetadata.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
loadDotenv({ path: path.resolve(rootDir, '.env.local') })
loadDotenv({ path: path.resolve(rootDir, '.env') })
const outputFolder = process.env.EXPORT ? 'out' : 'public'
const POSTS_COLLECTION = process.env.PAYLOAD_POSTS_COLLECTION?.trim() || 'posts'
const queryLimitValue = Number(process.env.PAYLOAD_QUERY_LIMIT || '1000')
const QUERY_LIMIT = Number.isFinite(queryLimitValue) && queryLimitValue > 0 ? queryLimitValue : 1000

function sortPosts(posts) {
  return [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

function toUTCString(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date().toUTCString()
  return parsed.toUTCString()
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return []
  return value.map((tag) => String(tag || '').trim()).filter(Boolean)
}

function normalizePost(doc) {
  const slugValue = String(doc?.slug || '').trim()
  const title = String(doc?.title || '').trim()
  if (!slugValue || !title) return null

  return {
    slug: slugValue,
    title,
    summary: String(doc?.summary || '').trim(),
    date: String(doc?.publishedAt || doc?.createdAt || new Date().toISOString()),
    tags: normalizeTags(doc?.tags),
  }
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

    return sortPosts((result?.docs || []).map(normalizePost).filter(Boolean))
  } finally {
    try {
      if (payloadClient && typeof payloadClient.destroy === 'function') {
        await payloadClient.destroy()
      } else if (payloadClient?.db && typeof payloadClient.db.destroy === 'function') {
        await payloadClient.db.destroy()
      }
    } catch (error) {
      console.warn('[rss] failed to close Payload connection cleanly', error)
    }
  }
}

const generateRssItem = (config, post) => `
  <item>
    <guid>${config.siteUrl}/blog/${post.slug}</guid>
    <title>${escape(post.title)}</title>
    <link>${config.siteUrl}/blog/${post.slug}</link>
    ${post.summary && `<description>${escape(post.summary)}</description>`}
    <pubDate>${toUTCString(post.date)}</pubDate>
    <author>${config.email} (${config.author})</author>
    ${post.tags && post.tags.map((tag) => `<category>${escape(tag)}</category>`).join('')}
  </item>
`

const generateRss = (config, posts, page = 'feed.xml') => `
  <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
      <title>${escape(config.title)}</title>
      <link>${config.siteUrl}/blog</link>
      <description>${escape(config.description)}</description>
      <language>${config.language}</language>
      <managingEditor>${config.email} (${config.author})</managingEditor>
      <webMaster>${config.email} (${config.author})</webMaster>
      <lastBuildDate>${toUTCString(posts[0]?.date)}</lastBuildDate>
      <atom:link href="${config.siteUrl}/${page}" rel="self" type="application/rss+xml"/>
      ${posts.map((post) => generateRssItem(config, post)).join('')}
    </channel>
  </rss>
`

async function generateRSS(config, posts, page = 'feed.xml') {
  const sortedPublishedPosts = sortPosts(posts)
  const rss = generateRss(config, sortedPublishedPosts, page)
  writeFileSync(`./${outputFolder}/${page}`, rss)

  const tagSlugs = [
    ...new Set(
      sortedPublishedPosts.flatMap((post) => post.tags.map((tag) => slug(String(tag || '').trim())))
    ),
  ].filter(Boolean)

  for (const tagSlug of tagSlugs) {
    const filteredPosts = sortedPublishedPosts.filter((post) =>
      post.tags.some((tag) => slug(String(tag || '').trim()) === tagSlug)
    )
    if (filteredPosts.length === 0) continue

    const tagRss = generateRss(config, filteredPosts, `tags/${tagSlug}/${page}`)
    const rssPath = path.join(outputFolder, 'tags', tagSlug)
    mkdirSync(rssPath, { recursive: true })
    writeFileSync(path.join(rssPath, page), tagRss)
  }
}

const rss = async (options = {}) => {
  const posts = Array.isArray(options.posts) ? options.posts : await getPublishedPosts()
  await generateRSS(siteMetadata, posts)
  console.log('RSS feed generated...')
}

export default rss
