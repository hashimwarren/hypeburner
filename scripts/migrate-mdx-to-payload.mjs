import { mkdtempSync, rmSync } from 'fs'
import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { pathToFileURL } from 'url'
import { build } from 'esbuild'
import { config as loadDotenv } from 'dotenv'
import matter from 'gray-matter'

const rootDir = process.cwd()
const authorsDir = path.join(rootDir, 'data', 'authors')
const blogDir = path.join(rootDir, 'data', 'blog')

const importModule = (specifier) => Function('s', 'return import(s)')(specifier)

loadDotenv({ path: path.resolve(rootDir, '.env.local') })
loadDotenv({ path: path.resolve(rootDir, '.env') })

const AUTHORS_COLLECTION = process.env.PAYLOAD_AUTHORS_COLLECTION?.trim() || 'authors'
const POSTS_COLLECTION = process.env.PAYLOAD_POSTS_COLLECTION?.trim() || 'posts'

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

function markdownToLexicalFallback(markdown) {
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

async function createMarkdownToLexicalConverter(config) {
  if (!config) return markdownToLexicalFallback

  try {
    const lexicalModule = await importModule('@payloadcms/richtext-lexical')
    const { convertMarkdownToLexical, editorConfigFactory } = lexicalModule

    if (!convertMarkdownToLexical || !editorConfigFactory?.default) {
      return markdownToLexicalFallback
    }

    const editorConfig = await editorConfigFactory.default({ config })
    return (markdown) =>
      convertMarkdownToLexical({
        editorConfig,
        markdown: String(markdown || '').replace(/\r\n/g, '\n').trim(),
      })
  } catch (error) {
    console.warn('[migrate] failed to initialize markdown converter; using fallback rich text', error)
    return markdownToLexicalFallback
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
  async function importTsConfigModule(candidate) {
    const resolvedPath = path.isAbsolute(candidate) ? candidate : path.resolve(rootDir, candidate)
    const tempDir = mkdtempSync(path.join(rootDir, '.tmp-payload-config-'))
    const outputPath = path.join(tempDir, 'payload.config.mjs')

    try {
      await build({
        entryPoints: [resolvedPath],
        outfile: outputPath,
        bundle: true,
        packages: 'external',
        platform: 'node',
        format: 'esm',
        target: 'node20',
        sourcemap: false,
      })

      const importedModule = await importModule(pathToFileURL(outputPath).href)
      return importedModule?.default || importedModule
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  }

  const candidates = []
  if (process.env.PAYLOAD_CONFIG_PATH?.trim()) candidates.push(process.env.PAYLOAD_CONFIG_PATH.trim())
  candidates.push(
    '@payload-config',
    path.resolve(rootDir, 'payload.config.js'),
    path.resolve(rootDir, 'payload.config.ts')
  )

  for (const candidate of candidates) {
    try {
      if (candidate.endsWith('.ts')) {
        return await importTsConfigModule(candidate)
      }

      const importedModule = candidate.startsWith('@')
        ? await importModule(candidate)
        : await importModule(pathToFileURL(path.isAbsolute(candidate) ? candidate : path.resolve(rootDir, candidate)).href)
      return importedModule?.default || importedModule
    } catch {
      continue
    }
  }

  return null
}

async function createClient() {
  const config = await resolvePayloadConfig()
  if (!config) {
    throw new Error(
      '[migrate] Unable to resolve Payload config. Set PAYLOAD_CONFIG_PATH or ensure payload.config.ts is loadable.'
    )
  }

  const markdownToLexical = await createMarkdownToLexicalConverter(config)

  try {
    const payloadModule = await importModule('payload')
    if (payloadModule?.getPayload) {
      const localPayload = await payloadModule.getPayload({ config })
      return {
        mode: 'local',
        markdownToLexical,
        async destroy() {
          if (typeof localPayload.destroy === 'function') {
            await localPayload.destroy()
          } else if (localPayload?.db && typeof localPayload.db.destroy === 'function') {
            await localPayload.db.destroy()
          }
        },
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
    throw new Error('[migrate] payload.getPayload is unavailable in this environment.')
  } catch (error) {
    throw new Error('[migrate] Failed to initialize local Payload client.', { cause: error })
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
  try {
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
        bioRichText: client.markdownToLexical(parsed.content),
      }

      const doc = await upsertBySlug(client, AUTHORS_COLLECTION, slug, data, apply)
      if (doc?.id) {
        authorIdBySlug.set(slug, String(doc.id))
      }
    }

    for (const filePath of postFiles) {
      const parsed = await parseMdxFile(filePath)
      const slug = slugFromFile(blogDir, parsed.filePath)
      const isDraft = asBoolean(parsed.frontmatter.draft)

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
        status: isDraft ? 'draft' : 'published',
        _status: isDraft ? 'draft' : 'published',
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
        content: client.markdownToLexical(parsed.content),
        sourceMarkdown: parsed.content,
        legacySourcePath: path.relative(rootDir, parsed.filePath).replace(/\\/g, '/'),
      }

      await upsertBySlug(client, POSTS_COLLECTION, slug, data, apply)
    }
  } finally {
    if (typeof client.destroy === 'function') {
      await client.destroy()
    }
  }
}

run()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
