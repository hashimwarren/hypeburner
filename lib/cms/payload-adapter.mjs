import { slug as slugifyTag } from 'github-slugger'

const POSTS_COLLECTION = process.env.PAYLOAD_POSTS_COLLECTION?.trim() || 'posts'
const AUTHORS_COLLECTION = process.env.PAYLOAD_AUTHORS_COLLECTION?.trim() || 'authors'
const DEFAULT_LIMIT = Number(process.env.PAYLOAD_QUERY_LIMIT || 1000)

let payloadClientPromise

const importModule = (specifier) => Function('s', 'return import(s)')(specifier)

function normalizeTrimmed(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

function normalizePostSlug(value) {
  return decodeURI(normalizeTrimmed(value)).replace(/^blog\//, '')
}

function arrayOfStrings(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object' && typeof item.tag === 'string') return item.tag.trim()
      return ''
    })
    .filter(Boolean)
}

function asIsoDate(value) {
  if (!value) return new Date().toISOString()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

function isDraftDocument(doc) {
  if (typeof doc?.status === 'string') {
    return doc.status === 'draft'
  }

  if (typeof doc?._status === 'string') {
    return doc._status === 'draft'
  }

  return doc?.draft === true
}

function isPublishedDocument(doc) {
  if (typeof doc?.status === 'string') {
    return doc.status === 'published'
  }

  if (typeof doc?._status === 'string') {
    return doc._status === 'published'
  }

  return !isDraftDocument(doc)
}

function inferCategoryFromSlug(slug) {
  if (slug.startsWith('newsletter/')) return 'newsletter'
  if (slug.startsWith('news/')) return 'news'
  return undefined
}

function normalizeImageList(images) {
  if (typeof images === 'string') return [images]
  return arrayOfStrings(images)
}

function getBodyPayload(source) {
  const code =
    source?.body?.code ||
    source?.content?.code ||
    source?.mdx?.code ||
    source?.mdxCode ||
    source?.code ||
    ''
  const html = source?.body?.html || source?.contentHtml || source?.content?.html || source?.html || ''
  const raw = source?.body?.raw || source?.content?.raw || source?.markdown || source?.bio || ''
  const lexical = source?.content || source?.bioRichText || null

  return { code, html, raw, lexical }
}

function mapAuthor(rawAuthor) {
  if (!rawAuthor || typeof rawAuthor !== 'object') return null

  const body = getBodyPayload(rawAuthor)
  const socialLinks = rawAuthor.socialLinks || {}

  return {
    id: String(rawAuthor.id || rawAuthor._id || ''),
    slug: normalizeTrimmed(rawAuthor.slug || rawAuthor.handle || ''),
    name: rawAuthor.name || rawAuthor.displayName || '',
    avatar: rawAuthor.avatar || rawAuthor.avatarUrl || '',
    occupation: rawAuthor.occupation || '',
    company: rawAuthor.company || '',
    email: rawAuthor.email || '',
    twitter: rawAuthor.twitter || socialLinks.x || '',
    bluesky: rawAuthor.bluesky || '',
    linkedin: rawAuthor.linkedin || socialLinks.website || '',
    github: rawAuthor.github || socialLinks.github || '',
    body,
  }
}

function extractAuthorRelations(rawPost) {
  const relations = Array.isArray(rawPost?.authors)
    ? rawPost.authors
    : rawPost?.author
      ? [rawPost.author]
      : []
  const authorDetails = []
  const relationRefs = []

  for (const relation of relations) {
    if (!relation) continue
    if (typeof relation === 'string' || typeof relation === 'number') {
      relationRefs.push(String(relation))
      continue
    }
    if (typeof relation !== 'object') continue

    const relationValue = relation.value && typeof relation.value === 'object' ? relation.value : relation
    if (relationValue?.id || relationValue?.slug || relationValue?.name || relationValue?.displayName) {
      const mapped = mapAuthor(relationValue)
      if (mapped) authorDetails.push(mapped)
    } else if (relation.id || relation.slug) {
      relationRefs.push(String(relation.id || relation.slug))
    }
  }

  return { authorDetails, relationRefs }
}

function mapPost(rawPost) {
  const slug = normalizePostSlug(rawPost?.slug || rawPost?.path || '')
  if (!slug) return null

  const { authorDetails, relationRefs } = extractAuthorRelations(rawPost)
  const authors = authorDetails
    .map((author) => author.slug || author.id)
    .filter(Boolean)
    .concat(relationRefs)

  const date = asIsoDate(rawPost?.publishedAt || rawPost?.date || rawPost?.createdAt)
  const lastmod = asIsoDate(rawPost?.lastmod || rawPost?.updatedAt || rawPost?.updated_at || date)
  const tags = arrayOfStrings(rawPost?.tags)
  const body = getBodyPayload(rawPost)

  return {
    id: String(rawPost.id || rawPost._id || slug),
    slug,
    path: `blog/${slug}`,
    filePath: rawPost.legacySourcePath || rawPost.filePath || `blog/${slug}.mdx`,
    date,
    lastmod,
    title: rawPost.title || '',
    summary: rawPost.summary || rawPost.excerpt || '',
    tags,
    draft: isDraftDocument(rawPost),
    layout: rawPost.layout || undefined,
    images: normalizeImageList(rawPost.images),
    authors,
    authorDetails,
    category: rawPost.category || inferCategoryFromSlug(slug),
    body,
    toc: Array.isArray(rawPost?.toc) ? rawPost.toc : [],
    bibliography: rawPost.bibliography || '',
    canonicalUrl: rawPost.canonicalUrl || '',
    structuredData: rawPost.structuredData || null,
  }
}

async function resolvePayloadConfig() {
  const candidates = []
  if (process.env.PAYLOAD_CONFIG_PATH?.trim()) {
    candidates.push(process.env.PAYLOAD_CONFIG_PATH.trim())
  }
  candidates.push(
    '@payload-config',
    '../../payload.config.js',
    '../../payload.config.mjs',
    '../../payload.config.ts',
    '../../src/payload.config.js',
    '../../src/payload.config.mjs'
  )

  for (const specifier of candidates) {
    try {
      const configModule = await importModule(specifier)
      return configModule?.default || configModule
    } catch {
      continue
    }
  }

  return null
}

async function getPayloadClient() {
  if (payloadClientPromise) return payloadClientPromise

  payloadClientPromise = (async () => {
    try {
      const payloadModule = await importModule('payload')
      if (!payloadModule?.getPayload) return null

      const config = await resolvePayloadConfig()
      if (!config) return null

      return payloadModule.getPayload({ config })
    } catch {
      return null
    }
  })().then((client) => {
    if (!client) payloadClientPromise = undefined
    return client
  })

  return payloadClientPromise
}

function getPayloadRestBaseUrl() {
  return (
    process.env.PAYLOAD_LOCAL_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    'http://localhost:3000'
  ).replace(/\/+$/, '')
}

async function fetchCollectionWithPayload(collection) {
  const payload = await getPayloadClient()
  if (!payload) return null

  const allDocs = []
  let page = 1

  while (true) {
    const response = await payload.find({
      collection,
      depth: 2,
      limit: DEFAULT_LIMIT,
      page,
    })

    if (!Array.isArray(response?.docs) || response.docs.length === 0) break

    allDocs.push(...response.docs)

    if (typeof response.total === 'number' && allDocs.length >= response.total) break
    if (
      typeof response.page === 'number' &&
      typeof response.totalPages === 'number' &&
      response.page >= response.totalPages
    ) {
      break
    }
    if (response.docs.length < DEFAULT_LIMIT) break

    page += 1
  }

  return allDocs
}

async function fetchCollectionWithRest(collection) {
  const allDocs = []
  let page = 1

  while (true) {
    const url = new URL(`/api/${collection}`, getPayloadRestBaseUrl())
    url.searchParams.set('limit', String(DEFAULT_LIMIT))
    url.searchParams.set('depth', '2')
    url.searchParams.set('page', String(page))

    const response = await fetch(url.toString(), { cache: 'no-store' })
    if (!response.ok) {
      let bodyText = ''
      try {
        bodyText = await response.text()
      } catch {}

      const statusInfo = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
      const bodyInfo = bodyText ? ` - Response body: ${bodyText.slice(0, 500)}` : ''
      throw new Error(`Failed to fetch ${collection} from Payload REST API (${statusInfo})${bodyInfo}`)
    }

    const payload = await response.json()
    if (!Array.isArray(payload?.docs) || payload.docs.length === 0) break

    allDocs.push(...payload.docs)

    if (typeof payload.total === 'number' && allDocs.length >= payload.total) break
    if (
      typeof payload.page === 'number' &&
      typeof payload.totalPages === 'number' &&
      payload.page >= payload.totalPages
    ) {
      break
    }
    if (payload.docs.length < DEFAULT_LIMIT) break

    page += 1
  }

  return allDocs
}

async function fetchCollection(collection) {
  const localDocs = await fetchCollectionWithPayload(collection)
  if (localDocs) return localDocs
  try {
    return await fetchCollectionWithRest(collection)
  } catch (error) {
    console.error(`[payload-adapter] Failed to fetch "${collection}"`, error)
    return []
  }
}

async function getPostDocs() {
  return fetchCollection(POSTS_COLLECTION)
}

async function getAuthorDocs() {
  return fetchCollection(AUTHORS_COLLECTION)
}

function shouldIncludeDrafts(includeDrafts) {
  if (typeof includeDrafts === 'boolean') return includeDrafts
  return process.env.NODE_ENV !== 'production'
}

export function sortPostsByDate(posts) {
  return [...posts].sort((a, b) => {
    const dateA = new Date(a.lastmod || a.date).getTime()
    const dateB = new Date(b.lastmod || b.date).getTime()
    return dateB - dateA
  })
}

export async function getAllAuthors() {
  const docs = await getAuthorDocs()
  return docs.map(mapAuthor).filter(Boolean)
}

export async function getDefaultAuthor() {
  const authors = await getAllAuthors()
  return authors.find((author) => author.slug === 'default') || authors[0] || null
}

export async function getAboutAuthor() {
  return getDefaultAuthor()
}

async function hydratePostAuthors(post, authorsInput, defaultAuthorInput) {
  if (!post) return null
  if (post.authorDetails.length > 0) return post

  const authors = Array.isArray(authorsInput) ? authorsInput : await getAllAuthors()
  const defaultAuthor =
    defaultAuthorInput === undefined
      ? authors.find((author) => author.slug === 'default') || authors[0] || null
      : defaultAuthorInput
  const relationKeys = new Set(post.authors.map((value) => String(value)))
  const authorDetails = authors.filter(
    (author) => relationKeys.has(author.id) || relationKeys.has(author.slug)
  )

  if (authorDetails.length === 0) {
    if (defaultAuthor) authorDetails.push(defaultAuthor)
  }

  const authorSlugs = authorDetails.map((author) => author.slug).filter(Boolean)
  return {
    ...post,
    authorDetails,
    authors: authorSlugs.length > 0 ? authorSlugs : post.authors,
  }
}

export async function getAllPosts(options = {}) {
  const includeDrafts = shouldIncludeDrafts(options.includeDrafts)
  const [docs, authors] = await Promise.all([getPostDocs(), getAllAuthors()])
  const defaultAuthor = authors.find((author) => author.slug === 'default') || authors[0] || null
  const mapped = docs.map(mapPost).filter(Boolean)
  const hydrated = await Promise.all(
    mapped.map((post) => hydratePostAuthors(post, authors, defaultAuthor))
  )
  const visible = hydrated.filter((post) => {
    if (!post) return false
    if (includeDrafts) return true
    return !post.draft
  })

  return sortPostsByDate(visible)
}

export async function getPublishedPosts() {
  return getAllPosts({ includeDrafts: false })
}

export async function getHomePageData() {
  const [posts, defaultAuthor] = await Promise.all([getPublishedPosts(), getDefaultAuthor()])
  return { posts, defaultAuthor }
}

export async function getPostBySlug(slug, options = {}) {
  const includeDrafts = shouldIncludeDrafts(options.includeDrafts)
  const normalizedSlug = normalizePostSlug(slug)
  const posts = await getAllPosts({ includeDrafts })
  const post = posts.find((item) => item.slug === normalizedSlug)
  if (!post) return null
  return post
}

export async function getAllPostSlugs(options = {}) {
  const posts = await getAllPosts({ includeDrafts: options.includeDrafts })
  return posts.map((post) => post.slug)
}

export async function getPostsByTag(tag, options = {}) {
  const normalizedTag = decodeURI(normalizeTrimmed(tag))
  const posts = await getAllPosts({ includeDrafts: options.includeDrafts })

  return posts.filter((post) =>
    post.tags.some((postTag) => {
      const normalizedPostTag = postTag.trim()
      return (
        normalizedPostTag.toLowerCase() === normalizedTag.toLowerCase() ||
        slugifyTag(normalizedPostTag) === normalizedTag
      )
    })
  )
}

export async function getTagCounts(options = {}) {
  const posts = await getAllPosts({ includeDrafts: options.includeDrafts })
  const counts = {}

  for (const post of posts) {
    for (const tag of post.tags) {
      const key = slugifyTag(tag)
      if (!key) continue
      counts[key] = (counts[key] || 0) + 1
    }
  }

  return counts
}

export async function getTagSlugs(options = {}) {
  const counts = await getTagCounts(options)
  return Object.keys(counts)
}

export async function getSitemapEntries() {
  const posts = await getPublishedPosts()
  return posts.map((post) => ({
    path: post.path,
    lastModified: post.lastmod || post.date,
  }))
}

export async function getRssFeedData() {
  const posts = await getPublishedPosts()
  const tags = {}

  for (const post of posts) {
    for (const tag of post.tags) {
      const tagSlug = slugifyTag(tag)
      if (!tagSlug) continue
      if (!tags[tagSlug]) tags[tagSlug] = []
      tags[tagSlug].push(post)
    }
  }

  return {
    posts,
    tags,
  }
}

export function isNewsOrNewsletterPost(post) {
  if (!post) return false
  const category = String(post.category || '').toLowerCase()
  if (category === 'newsletter' || category === 'news') return true
  return post.slug.startsWith('newsletter/') || post.slug.startsWith('news/')
}
