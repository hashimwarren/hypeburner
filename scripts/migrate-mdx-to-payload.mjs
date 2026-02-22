import 'dotenv/config'
import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import matter from 'gray-matter'

const AUTHORS_COLLECTION = process.env.PAYLOAD_AUTHORS_COLLECTION?.trim() || 'authors'
const POSTS_COLLECTION = process.env.PAYLOAD_POSTS_COLLECTION?.trim() || 'posts'

const rootDir = process.cwd()
const authorsDir = path.join(rootDir, 'data', 'authors')
const blogDir = path.join(rootDir, 'data', 'blog')
const require = createRequire(import.meta.url)

const importModule = (specifier) => Function('s', 'return import(s)')(specifier)

function hasFlag(flag) {
  return process.argv.slice(2).includes(flag)
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asBoolean(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  return false
}

function asDate(value) {
  const raw = asString(value)
  if (!raw) return undefined
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

function toStringArray(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => asString(item)).filter(Boolean)
}

function toImageArray(value) {
  if (typeof value === 'string') return [value]
  return toStringArray(value)
}

function slugFromFile(baseDir, filePath) {
  return path.relative(baseDir, filePath).replace(/\\/g, '/').replace(/\.mdx$/i, '')
}

function inferCategory(slug) {
  if (slug.startsWith('newsletter/')) return 'newsletter'
  if (slug.startsWith('news/')) return 'news'
  return undefined
}

function markdownToLexical(markdown) {
  const normalized = String(markdown || '').replace(/\r\n/g, '\n').trim()
  const blocks = normalized ? normalized.split(/\n{2,}/) : ['']

  const paragraphs = blocks.map((block) => ({
    children: [
      {
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        text: block,
        type: 'text',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
    textFormat: 0,
    textStyle: '',
  }))

  return {
    root: {
      children: paragraphs,
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}

async function listMdxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listMdxFiles(entryPath)))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mdx')) {
      files.push(entryPath)
    }
  }
  files.sort()
  return files
}

async function parseMdxFile(filePath) {
  const source = await readFile(filePath, 'utf8')
  const parsed = matter(source)
  return {
    filePath,
    frontmatter: parsed.data || {},
    content: String(parsed.content || ''),
  }
}

async function resolvePayloadConfig() {
  const candidates = []
  if (process.env.PAYLOAD_CONFIG_PATH?.trim()) candidates.push(process.env.PAYLOAD_CONFIG_PATH.trim())
  candidates.push(
    '@payload-config',
    path.resolve(rootDir, 'payload.config.js'),
    path.resolve(rootDir, 'payload.config.mjs'),
    path.resolve(rootDir, 'payload.config.ts')
  )

  for (const candidate of candidates) {
    try {
      if (candidate.endsWith('.ts')) {
        const { register } = require('esbuild-register/dist/node')
        const { unregister } = register({
          hookIgnoreNodeModules: true,
          target: 'es2020',
        })
        try {
          const importedModule = require(candidate)
          return importedModule?.default || importedModule
        } finally {
          unregister()
        }
      }

      const importedModule =
        candidate.startsWith('@') ? await importModule(candidate) : await importModule(pathToFileURL(candidate).href)
      return importedModule?.default || importedModule
    } catch {
      continue
    }
  }

  return null
}

function getRestBaseUrl() {
  return (
    process.env.PAYLOAD_LOCAL_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    'http://localhost:3000'
  ).replace(/\/+$/, '')
}

async function requestRest(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (process.env.PAYLOAD_API_KEY?.trim()) {
    headers.Authorization = `users API-Key ${process.env.PAYLOAD_API_KEY.trim()}`
  }

  let response
  try {
    response = await fetch(url, { ...options, headers })
  } catch (error) {
    throw new Error(
      `Payload REST request failed to connect (${url}). Start the app server or set PAYLOAD_LOCAL_API_URL to a reachable CMS host.`,
      { cause: error }
    )
  }
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Payload REST request failed (${response.status}): ${body}`)
  }

  if (response.status === 204) return null
  return response.json()
}

async function createClient() {
  try {
    const payloadModule = await importModule('payload')
    const config = await resolvePayloadConfig()
    if (payloadModule?.getPayload && config) {
      const localPayload = await payloadModule.getPayload({ config })
      return {
        mode: 'local',
        async findBySlug(collection, slug) {
          const response = await localPayload.find({
            collection,
            where: { slug: { equals: slug } },
            depth: 0,
            limit: 1,
          })
          return response?.docs?.[0] || null
        },
        async create(collection, data) {
          return localPayload.create({ collection, data, depth: 0 })
        },
        async update(collection, id, data) {
          return localPayload.update({ collection, id, data, depth: 0 })
        },
      }
    }
  } catch {}

  return {
    mode: 'rest',
    async findBySlug(collection, slug) {
      const url = new URL(`/api/${collection}`, getRestBaseUrl())
      url.searchParams.set('depth', '0')
      url.searchParams.set('limit', '1')
      url.searchParams.set('where[slug][equals]', slug)
      const payload = await requestRest(url.toString())
      return payload?.docs?.[0] || null
    },
    async create(collection, data) {
      return requestRest(`${getRestBaseUrl()}/api/${collection}`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    async update(collection, id, data) {
      return requestRest(`${getRestBaseUrl()}/api/${collection}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
    },
  }
}

async function upsertBySlug(client, collection, slug, data, apply) {
  const existing = await client.findBySlug(collection, slug)
  if (!apply) {
    console.log(`[dry-run] ${existing ? 'update' : 'create'} ${collection}: ${slug}`)
    return { id: existing?.id || `dry-run:${slug}` }
  }

  if (existing?.id) {
    const updated = await client.update(collection, existing.id, data)
    console.log(`[apply] updated ${collection}: ${slug}`)
    return {
      ...updated,
      id: updated?.id || updated?.doc?.id || existing.id,
    }
  }

  const created = await client.create(collection, data)
  console.log(`[apply] created ${collection}: ${slug}`)
  return {
    ...created,
    id: created?.id || created?.doc?.id,
  }
}

async function run() {
  if (hasFlag('--help')) {
    console.log('Usage: node scripts/migrate-mdx-to-payload.mjs [--dry-run] [--apply]')
    return
  }

  const apply = hasFlag('--apply')
  const client = await createClient()
  console.log(`Migration mode: ${apply ? 'apply' : 'dry-run'} (transport: ${client.mode})`)

  const authorFiles = await listMdxFiles(authorsDir)
  const postFiles = await listMdxFiles(blogDir)
  const authorIdBySlug = new Map()

  for (const filePath of authorFiles) {
    const parsed = await parseMdxFile(filePath)
    const slug = slugFromFile(authorsDir, parsed.filePath)
    const data = {
      name: asString(parsed.frontmatter.name) || slug,
      slug,
      avatar: asString(parsed.frontmatter.avatar) || undefined,
      occupation: asString(parsed.frontmatter.occupation) || undefined,
      company: asString(parsed.frontmatter.company) || undefined,
      email: asString(parsed.frontmatter.email) || undefined,
      twitter: asString(parsed.frontmatter.twitter) || undefined,
      bluesky: asString(parsed.frontmatter.bluesky) || undefined,
      linkedin: asString(parsed.frontmatter.linkedin) || undefined,
      github: asString(parsed.frontmatter.github) || undefined,
      layout: asString(parsed.frontmatter.layout) || undefined,
      bioRichText: markdownToLexical(parsed.content),
    }

    const doc = await upsertBySlug(client, AUTHORS_COLLECTION, slug, data, apply)
    if (doc?.id) {
      authorIdBySlug.set(slug, String(doc.id))
    }
  }

  for (const filePath of postFiles) {
    const parsed = await parseMdxFile(filePath)
    const slug = slugFromFile(blogDir, parsed.filePath)

    const authorSlugs = toStringArray(parsed.frontmatter.authors)
    const resolvedAuthorIds = []
    for (const authorSlug of authorSlugs.length ? authorSlugs : ['default']) {
      let authorId = authorIdBySlug.get(authorSlug)
      if (!authorId) {
        const doc = await client.findBySlug(AUTHORS_COLLECTION, authorSlug)
        authorId = doc?.id || doc?.doc?.id
        if (authorId) authorIdBySlug.set(authorSlug, String(authorId))
      }
      if (authorId) {
        if (typeof authorId === 'string' && /^\d+$/.test(authorId)) {
          resolvedAuthorIds.push(Number(authorId))
        } else {
          resolvedAuthorIds.push(authorId)
        }
      }
    }

    if (resolvedAuthorIds.length === 0) {
      console.warn(`[skip] ${slug}: no matching author`)
      continue
    }

    const data = {
      title: asString(parsed.frontmatter.title) || slug,
      slug,
      status: asBoolean(parsed.frontmatter.draft) ? 'draft' : 'published',
      summary: asString(parsed.frontmatter.summary) || undefined,
      publishedAt: asDate(parsed.frontmatter.date),
      lastmod: asDate(parsed.frontmatter.lastmod),
      category: inferCategory(slug),
      tags: toStringArray(parsed.frontmatter.tags),
      authors: resolvedAuthorIds,
      layout: asString(parsed.frontmatter.layout) || 'PostLayout',
      images: toImageArray(parsed.frontmatter.images),
      bibliography: asString(parsed.frontmatter.bibliography) || undefined,
      canonicalUrl: asString(parsed.frontmatter.canonicalUrl) || undefined,
      content: markdownToLexical(parsed.content),
      legacySourcePath: path.relative(rootDir, parsed.filePath).replace(/\\/g, '/'),
    }

    await upsertBySlug(client, POSTS_COLLECTION, slug, data, apply)
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
