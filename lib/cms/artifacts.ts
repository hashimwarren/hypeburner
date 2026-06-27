import readingTime from 'reading-time'
import siteMetadata from '@/data/siteMetadata'
import type { CmsPost } from './types'

type RssConfig = {
  author: string
  description: string
  email: string
  language: string
  siteUrl: string
  title: string
}

export type SearchDocument = {
  title: string
  date: string
  tags: string[]
  draft: false
  summary: string
  images: string[]
  type: 'Blog'
  readingTime: ReturnType<typeof readingTime>
  slug: string
  path: string
  filePath: string
  toc: []
  structuredData: Record<string, unknown>
}

function toDateValue(value: unknown): string {
  const text = String(value || '').trim()
  if (!text) return new Date().toISOString()

  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function toUTCString(value: unknown): string {
  return new Date(toDateValue(value)).toUTCString()
}

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cleanLegacyPath(value: unknown, slugValue: string): string {
  const raw = String(value || '').trim()
  if (!raw) return `blog/${slugValue}.mdx`
  return raw.replace(/^data\//, '')
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => String(entry || '').trim()).filter(Boolean)
}

export function getTagSlug(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\0-\x1F!-,.\/:-@\[-\^`\{-~]/g, '')
    .replace(/ /g, '-')
}

export function getPublishedCmsPosts(posts: CmsPost[]): CmsPost[] {
  return posts
    .filter((post) => !post.draft)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function buildTagData(posts: CmsPost[]): Record<string, number> {
  const tagCount: Record<string, number> = {}

  for (const post of getPublishedCmsPosts(posts)) {
    for (const tag of post.tags || []) {
      const normalized = getTagSlug(tag)
      if (!normalized) continue
      tagCount[normalized] = (tagCount[normalized] || 0) + 1
    }
  }

  return tagCount
}

export function buildSearchDocuments(posts: CmsPost[]): SearchDocument[] {
  return getPublishedCmsPosts(posts).map((post) => {
    const images = toStringArray(post.images)
    const date = toDateValue(post.date)
    const lastmod = toDateValue(post.lastmod || date)

    return {
      title: post.title,
      date,
      tags: toStringArray(post.tags),
      draft: false,
      summary: post.summary || '',
      images,
      type: 'Blog',
      readingTime: readingTime(post.sourceMarkdown || post.summary || post.title),
      slug: post.slug,
      path: `blog/${post.slug}`,
      filePath: cleanLegacyPath(post.legacySourcePath, post.slug),
      toc: [],
      structuredData: post.structuredData || {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        datePublished: date,
        dateModified: lastmod,
        description: post.summary || '',
        image: images[0] || siteMetadata.socialBanner,
        url: `${siteMetadata.siteUrl}/blog/${post.slug}`,
      },
    }
  })
}

function buildRssItem(config: RssConfig, post: CmsPost): string {
  const tags = toStringArray(post.tags)
    .map((tag) => `<category>${escapeXml(tag)}</category>`)
    .join('')

  return `
  <item>
    <guid>${escapeXml(`${config.siteUrl}/blog/${post.slug}`)}</guid>
    <title>${escapeXml(post.title)}</title>
    <link>${escapeXml(`${config.siteUrl}/blog/${post.slug}`)}</link>
    ${post.summary ? `<description>${escapeXml(post.summary)}</description>` : ''}
    <pubDate>${toUTCString(post.date)}</pubDate>
    <author>${escapeXml(`${config.email} (${config.author})`)}</author>
    ${tags}
  </item>`
}

export function buildRssXml(
  posts: CmsPost[],
  page = 'feed.xml',
  config: RssConfig = siteMetadata
): string {
  const publishedPosts = getPublishedCmsPosts(posts)

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(config.title)}</title>
    <link>${escapeXml(`${config.siteUrl}/blog`)}</link>
    <description>${escapeXml(config.description)}</description>
    <language>${escapeXml(config.language)}</language>
    <managingEditor>${escapeXml(`${config.email} (${config.author})`)}</managingEditor>
    <webMaster>${escapeXml(`${config.email} (${config.author})`)}</webMaster>
    <lastBuildDate>${toUTCString(publishedPosts[0]?.date)}</lastBuildDate>
    <atom:link href="${escapeXml(`${config.siteUrl}/${page}`)}" rel="self" type="application/rss+xml"/>
    ${publishedPosts.map((post) => buildRssItem(config, post)).join('')}
  </channel>
</rss>
`
}
