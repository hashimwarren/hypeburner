#!/usr/bin/env node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
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
const DEFAULT_REPORT_PATH = path.resolve(rootDir, 'scripts', 'reports', 'migration-report.json')
const DEFAULT_MANUAL_PATH = path.resolve(rootDir, 'scripts', 'reports', 'migration-manual-fixes.json')

function hasFlag(flag) {
  return process.argv.slice(2).includes(flag)
}

function getOptionValue(flag, fallback) {
  const args = process.argv.slice(2)
  const direct = args.find((arg) => arg.startsWith(`${flag}=`))
  if (direct) return direct.slice(flag.length + 1).trim() || fallback

  const index = args.indexOf(flag)
  if (index !== -1 && args[index + 1]) return args[index + 1].trim()
  return fallback
}

function ensureReportDirectory(filePath) {
  mkdirSync(path.dirname(filePath), { recursive: true })
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

function stripCodeFences(markdown) {
  return String(markdown || '').replace(/```[\s\S]*?```/g, '')
}

function detectUnsupportedMdx(markdown) {
  const stripped = stripCodeFences(markdown)
  const reasons = []

  if (/^\s*import\s.+from\s.+$/m.test(stripped)) reasons.push('mdx-import')
  if (/^\s*export\s/m.test(stripped)) reasons.push('mdx-export')
  if (/<[A-Z][A-Za-z0-9_.-]*\b[^>]*>/.test(stripped)) reasons.push('jsx-component')
  if (/\{[^}\n]+\}/.test(stripped)) reasons.push('mdx-expression')

  return [...new Set(reasons)]
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
  if (!config) return async (markdown) => markdownToLexicalFallback(markdown)

  try {
    const lexicalModule = await importModule('@payloadcms/richtext-lexical')
    const { convertMarkdownToLexical, editorConfigFactory } = lexicalModule

    if (!convertMarkdownToLexical || !editorConfigFactory?.default) {
      return async (markdown) => markdownToLexicalFallback(markdown)
    }

    const editorConfig = await editorConfigFactory.default({ config })
    return async (markdown) =>
      convertMarkdownToLexical({
        editorConfig,
        markdown: String(markdown || '').replace(/\r\n/g, '\n').trim(),
      })
  } catch (error) {
    console.warn('[migrate] failed to initialize markdown converter; fallback converter will be used', error)
    return async (markdown) => markdownToLexicalFallback(markdown)
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

function normalizeForComparison(value) {
  if (value === undefined) return null
  if (value === null) return null
  if (Array.isArray(value)) return value.map((entry) => normalizeForComparison(entry))
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort()
    const normalized = {}
    for (const key of keys) {
      normalized[key] = normalizeForComparison(value[key])
    }
    return normalized
  }
  return value
}

function isSameValue(left, right) {
  const leftSerialized = JSON.stringify(normalizeForComparison(left))
  const rightSerialized = JSON.stringify(normalizeForComparison(right))
  return leftSerialized === rightSerialized
}

function getChangedFields(existingDoc, nextData) {
  const changed = []
  for (const key of Object.keys(nextData)) {
    if (!isSameValue(existingDoc?.[key], nextData[key])) {
      changed.push(key)
    }
  }
  return changed
}

function increment(report, section, key) {
  report.summary[section][key] += 1
}

function addManualItem(report, collection, slug, filePath, reasons) {
  report.manualQueue.push({
    collection,
    slug,
    filePath: path.relative(rootDir, filePath).replace(/\\/g, '/'),
    reasons,
  })
}

async function createClient() {
  const config = await resolvePayloadConfig()
  if (!config) {
    throw new Error(
      '[migrate] Unable to resolve Payload config. Set PAYLOAD_CONFIG_PATH or ensure payload.config.ts is loadable.'
    )
  }

  const markdownToLexical = await createMarkdownToLexicalConverter(config)
  const payloadModule = await importModule('payload')
  if (!payloadModule?.getPayload) {
    throw new Error('[migrate] payload.getPayload is unavailable in this environment.')
  }

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
        overrideAccess: true,
      })
      return response?.docs?.[0] || null
    },
    async create(collection, data) {
      return localPayload.create({ collection, data, depth: 0, overrideAccess: true })
    },
    async update(collection, id, data) {
      return localPayload.update({ collection, id, data, depth: 0, overrideAccess: true })
    },
  }
}

async function applySyncBySlug({ client, collection, slug, data, apply }) {
  const existing = await client.findBySlug(collection, slug)
  const changedFields = existing ? getChangedFields(existing, data) : Object.keys(data)

  if (!existing) {
    if (apply) {
      const created = await client.create(collection, data)
      return {
        action: 'create',
        changedFields,
        id: created?.id || created?.doc?.id || null,
      }
    }
    return {
      action: 'create',
      changedFields,
      id: `dry-run:${collection}:${slug}`,
    }
  }

  if (changedFields.length === 0) {
    return {
      action: 'unchanged',
      changedFields: [],
      id: existing.id,
    }
  }

  if (apply) {
    await client.update(collection, existing.id, data)
  }

  return {
    action: 'update',
    changedFields,
    id: existing.id,
  }
}

function createReport({ apply, strict }) {
  return {
    mode: apply ? 'apply' : 'dry-run',
    strict,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    transport: 'unknown',
    summary: {
      authors: { created: 0, updated: 0, unchanged: 0, skipped: 0, errors: 0, needsManual: 0 },
      posts: { created: 0, updated: 0, unchanged: 0, skipped: 0, errors: 0, needsManual: 0 },
    },
    entries: [],
    manualQueue: [],
    artifacts: null,
    error: null,
  }
}

async function run() {
  if (hasFlag('--help')) {
    console.log(
      [
        'Usage: node scripts/migrate-mdx-to-payload.mjs [--dry-run] [--apply] [--strict] [--skip-artifacts] [--report <path>]',
        '',
        '--dry-run        Plan migration without writes (default).',
        '--apply          Execute creates/updates.',
        '--strict         Fail if unsupported MDX constructs are detected.',
        '--skip-artifacts Skip post-apply artifact generation.',
        '--report         Path for JSON report output.',
      ].join('\n')
    )
    return
  }

  const apply = hasFlag('--apply')
  const strict = hasFlag('--strict')
  const skipArtifacts = hasFlag('--skip-artifacts')
  const reportPath = path.resolve(rootDir, getOptionValue('--report', DEFAULT_REPORT_PATH))
  const manualQueuePath = path.resolve(rootDir, DEFAULT_MANUAL_PATH)
  const report = createReport({ apply, strict })

  ensureReportDirectory(reportPath)
  ensureReportDirectory(manualQueuePath)

  let client
  try {
    client = await createClient()
    report.transport = client.mode
    console.log(`Migration mode: ${report.mode} (transport: ${client.mode}, strict: ${strict})`)

    const authorFiles = await listMdxFiles(authorsDir)
    const postFiles = await listMdxFiles(blogDir)
    const authorIdBySlug = new Map()

    for (const filePath of authorFiles) {
      const parsed = await parseMdxFile(filePath)
      const slug = slugFromFile(authorsDir, parsed.filePath)
      const unsupported = detectUnsupportedMdx(parsed.content)

      if (unsupported.length > 0) {
        addManualItem(report, AUTHORS_COLLECTION, slug, parsed.filePath, unsupported)
        increment(report, 'authors', 'needsManual')
        if (strict) {
          increment(report, 'authors', 'skipped')
          report.entries.push({
            collection: AUTHORS_COLLECTION,
            slug,
            filePath: path.relative(rootDir, parsed.filePath).replace(/\\/g, '/'),
            action: 'needs-manual',
            reasons: unsupported,
          })
          continue
        }
      }

      try {
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
          bioRichText: await client.markdownToLexical(parsed.content),
        }

        const syncResult = await applySyncBySlug({
          client,
          collection: AUTHORS_COLLECTION,
          slug,
          data,
          apply,
        })

        if (syncResult.action === 'create') increment(report, 'authors', 'created')
        if (syncResult.action === 'update') increment(report, 'authors', 'updated')
        if (syncResult.action === 'unchanged') increment(report, 'authors', 'unchanged')

        report.entries.push({
          collection: AUTHORS_COLLECTION,
          slug,
          filePath: path.relative(rootDir, parsed.filePath).replace(/\\/g, '/'),
          action: syncResult.action,
          changedFields: syncResult.changedFields,
          reasons: unsupported,
        })

        if (syncResult.id) {
          authorIdBySlug.set(slug, String(syncResult.id))
        }
      } catch (error) {
        increment(report, 'authors', 'errors')
        report.entries.push({
          collection: AUTHORS_COLLECTION,
          slug,
          filePath: path.relative(rootDir, parsed.filePath).replace(/\\/g, '/'),
          action: 'error',
          error: String(error),
        })
      }
    }

    for (const filePath of postFiles) {
      const parsed = await parseMdxFile(filePath)
      const slug = slugFromFile(blogDir, parsed.filePath)
      const unsupported = detectUnsupportedMdx(parsed.content)

      if (unsupported.length > 0) {
        addManualItem(report, POSTS_COLLECTION, slug, parsed.filePath, unsupported)
        increment(report, 'posts', 'needsManual')
        if (strict) {
          increment(report, 'posts', 'skipped')
          report.entries.push({
            collection: POSTS_COLLECTION,
            slug,
            filePath: path.relative(rootDir, parsed.filePath).replace(/\\/g, '/'),
            action: 'needs-manual',
            reasons: unsupported,
          })
          continue
        }
      }

      try {
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
          increment(report, 'posts', 'skipped')
          report.entries.push({
            collection: POSTS_COLLECTION,
            slug,
            filePath: path.relative(rootDir, parsed.filePath).replace(/\\/g, '/'),
            action: 'skip',
            reasons: ['missing-author'],
          })
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
          content: await client.markdownToLexical(parsed.content),
          sourceMarkdown: parsed.content,
          legacySourcePath: path.relative(rootDir, parsed.filePath).replace(/\\/g, '/'),
        }

        const syncResult = await applySyncBySlug({
          client,
          collection: POSTS_COLLECTION,
          slug,
          data,
          apply,
        })

        if (syncResult.action === 'create') increment(report, 'posts', 'created')
        if (syncResult.action === 'update') increment(report, 'posts', 'updated')
        if (syncResult.action === 'unchanged') increment(report, 'posts', 'unchanged')

        report.entries.push({
          collection: POSTS_COLLECTION,
          slug,
          filePath: path.relative(rootDir, parsed.filePath).replace(/\\/g, '/'),
          action: syncResult.action,
          changedFields: syncResult.changedFields,
          reasons: unsupported,
        })
      } catch (error) {
        increment(report, 'posts', 'errors')
        report.entries.push({
          collection: POSTS_COLLECTION,
          slug,
          filePath: path.relative(rootDir, parsed.filePath).replace(/\\/g, '/'),
          action: 'error',
          error: String(error),
        })
      }
    }

    if (apply && !skipArtifacts) {
      const artifactsModule = await importModule(pathToFileURL(path.resolve(rootDir, 'scripts', 'generate-cms-artifacts.mjs')).href)
      if (artifactsModule?.generateCmsArtifacts) {
        report.artifacts = await artifactsModule.generateCmsArtifacts()
      }
    }

    if (strict && report.manualQueue.length > 0) {
      throw new Error(
        `[migrate] Strict mode failed: ${report.manualQueue.length} files need manual MDX cleanup. See ${manualQueuePath}`
      )
    }
  } catch (error) {
    report.error = String(error)
    throw error
  } finally {
    report.finishedAt = new Date().toISOString()
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
    writeFileSync(manualQueuePath, `${JSON.stringify(report.manualQueue, null, 2)}\n`)

    if (client && typeof client.destroy === 'function') {
      await client.destroy()
    }

    console.log(`[migrate] report written to ${path.relative(rootDir, reportPath)}`)
    console.log(`[migrate] manual queue written to ${path.relative(rootDir, manualQueuePath)}`)
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
