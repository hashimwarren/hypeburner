export type CMSAuthor = {
  id?: string
  slug?: string
  name: string
  avatar?: string
  occupation?: string
  company?: string
  email?: string
  twitter?: string
  bluesky?: string
  linkedin?: string
  github?: string
}

export type CMSPost = {
  path: string
  slug: string
  filePath?: string
  date: string
  lastmod?: string
  title: string
  summary?: string
  tags?: string[]
  layout?: 'PostLayout' | 'PostSimple' | 'PostBanner' | string
  images?: string[]
  category?: string
  body?: {
    code?: string
    html?: string
    raw?: string
    lexical?: unknown
  }
  toc?: unknown[]
  canonicalUrl?: string
  structuredData?: Record<string, unknown> | null
}
