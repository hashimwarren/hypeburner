import { cache } from 'react'
import { slug } from 'github-slugger'
import { getPayload } from 'payload'
import { env } from '../../lib/env'
import config from '../../payload.config'
import type { SiteAuthor, SitePost } from './types'

const queryLimit = env.PAYLOAD_QUERY_LIMIT
const includeDrafts = env.includeDrafts

const getPayloadClient = cache(async () => await getPayload({ config }))

function cleanLegacyPath(value: unknown, slug: string): string {
  const raw = String(value || '').trim()
  if (!raw) return `blog/${slug}.mdx`
  return raw.replace(/^data\//, '')
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => String(entry || '').trim()).filter(Boolean)
}

function normalizeAuthor(value: unknown): SiteAuthor {
  if (!value) {
    return {
      slug: 'unknown',
      name: 'Unknown Author',
    }
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return {
      id: value,
      slug: String(value),
      name: String(value),
    }
  }

  const author = value as Record<string, unknown>
  return {
    id: author.id as string | number | undefined,
    slug: String(author.slug || author.id || 'unknown'),
    name: String(author.name || 'Unknown Author'),
    avatar: author.avatar ? String(author.avatar) : undefined,
    occupation: author.occupation ? String(author.occupation) : undefined,
    company: author.company ? String(author.company) : undefined,
    email: author.email ? String(author.email) : undefined,
    twitter: author.twitter ? String(author.twitter) : undefined,
    bluesky: author.bluesky ? String(author.bluesky) : undefined,
    linkedin: author.linkedin ? String(author.linkedin) : undefined,
    github: author.github ? String(author.github) : undefined,
    bioRichText: author.bioRichText,
  }
}

function normalizePost(value: Record<string, unknown>): SitePost {
  const slug = String(value.slug || '')
  const publishedAt = value.publishedAt ? String(value.publishedAt) : undefined
  const createdAt = value.createdAt ? String(value.createdAt) : new Date().toISOString()
  const updatedAt = value.updatedAt ? String(value.updatedAt) : undefined
  const explicitLastMod = value.lastmod ? String(value.lastmod) : undefined
  const images = Array.isArray(value.images) ? toStringArray(value.images) : []
  const authors = Array.isArray(value.authors) ? value.authors.map(normalizeAuthor) : []
  const tags = toStringArray(value.tags)
  const legacySourcePath = value.legacySourcePath ? String(value.legacySourcePath) : undefined

  return {
    id: (value.id as string | number | undefined) || slug,
    slug,
    path: `blog/${slug}`,
    filePath: cleanLegacyPath(legacySourcePath, slug),
    title: String(value.title || slug),
    summary: String(value.summary || ''),
    date: publishedAt || createdAt,
    lastmod: explicitLastMod || updatedAt || publishedAt || createdAt,
    tags,
    authors,
    layout: value.layout ? String(value.layout) : undefined,
    images,
    bibliography: value.bibliography ? String(value.bibliography) : undefined,
    canonicalUrl: value.canonicalUrl ? String(value.canonicalUrl) : undefined,
    content: value.content,
    sourceMarkdown: value.sourceMarkdown ? String(value.sourceMarkdown) : undefined,
    legacySourcePath,
    structuredData:
      value.structuredData && typeof value.structuredData === 'object'
        ? (value.structuredData as Record<string, unknown>)
        : undefined,
    draft: String(value.status || 'draft') !== 'published',
  }
}

function byMostRecent(a: SitePost, b: SitePost): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime()
}

export const getAllPosts = cache(async (): Promise<SitePost[]> => {
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: env.PAYLOAD_POSTS_COLLECTION,
    draft: includeDrafts,
    overrideAccess: true,
    depth: 2,
    limit: queryLimit,
    sort: '-publishedAt',
  })

  const posts = (result?.docs || []).map((doc: unknown) =>
    normalizePost(doc as Record<string, unknown>)
  )

  return posts.filter((post) => includeDrafts || !post.draft).sort(byMostRecent)
})

export async function getHomePosts(limit = 5): Promise<SitePost[]> {
  const posts = await getAllPosts()
  return posts.slice(0, limit)
}

export async function getPublishedPostsByTag(tagSlug: string): Promise<SitePost[]> {
  const posts = await getAllPosts()
  return posts.filter((post) =>
    post.tags.some(
      (tag) =>
        encodeURIComponent(tag.toLowerCase()) === tagSlug.toLowerCase() ||
        tag.toLowerCase() === tagSlug.toLowerCase()
    )
  )
}

export const getAllPostSlugs = cache(async (): Promise<string[]> => {
  const posts = await getAllPosts()
  return posts.map((post) => post.slug)
})

export const getPostBySlug = cache(async (slug: string): Promise<SitePost | null> => {
  const payload = await getPayloadClient()
  if (!payload) return null

  const result = await payload.find({
    collection: env.PAYLOAD_POSTS_COLLECTION,
    draft: includeDrafts,
    overrideAccess: true,
    depth: 2,
    where: {
      slug: {
        equals: slug,
      },
    },
    limit: 1,
  })

  const doc = result?.docs?.[0]
  if (!doc) return null
  const post = normalizePost(doc as Record<string, unknown>)

  if (!includeDrafts && post.draft) return null
  return post
})

export async function getTagCounts(): Promise<Record<string, number>> {
  const posts = await getAllPosts()
  const countsBySlug = new Map<string, { count: number; label: string }>()
  for (const post of posts) {
    for (const tag of post.tags) {
      const label = String(tag || '').trim()
      if (!label) continue

      const key = slug(label)
      if (!key) continue

      const current = countsBySlug.get(key)
      if (current) {
        current.count += 1
        // Prefer a humanized label when variants like `posthog` and `PostHog` collapse to one slug.
        if (current.label === current.label.toLowerCase() && label !== label.toLowerCase()) {
          current.label = label
        }
        continue
      }

      countsBySlug.set(key, { count: 1, label })
    }
  }

  return Object.fromEntries(
    Array.from(countsBySlug.values()).map((entry) => [entry.label, entry.count])
  )
}

export async function getDefaultAuthor(): Promise<SiteAuthor | null> {
  const payload = await getPayloadClient()
  if (!payload) return null

  const bySlug = await payload.find({
    collection: env.PAYLOAD_AUTHORS_COLLECTION,
    where: {
      slug: {
        equals: 'default',
      },
    },
    limit: 1,
  })

  const fallback = await payload.find({
    collection: env.PAYLOAD_AUTHORS_COLLECTION,
    limit: 1,
  })

  const author = bySlug?.docs?.[0] || fallback?.docs?.[0]
  if (!author) return null
  return normalizeAuthor(author as Record<string, unknown>)
}
