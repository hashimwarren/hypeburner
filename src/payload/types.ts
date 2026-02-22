export type SiteAuthor = {
  id?: number | string
  slug: string
  name: string
  avatar?: string
  occupation?: string
  company?: string
  email?: string
  twitter?: string
  bluesky?: string
  linkedin?: string
  github?: string
  bioRichText?: unknown
}

export type SitePost = {
  id: number | string
  slug: string
  path: string
  filePath: string
  title: string
  summary: string
  date: string
  lastmod?: string
  tags: string[]
  authors: SiteAuthor[]
  layout?: string
  images: string[]
  bibliography?: string
  canonicalUrl?: string
  content?: unknown
  sourceMarkdown?: string
  legacySourcePath?: string
  structuredData?: Record<string, unknown>
  draft: boolean
}

export type SitePostLink = {
  path: string
  title: string
}
