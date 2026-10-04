import type { SitePost, SitePostSummary } from '../../src/payload/types'

// Explicitly select the fields displayed by archives before crossing the client boundary.
// A type annotation alone would leave article bodies and other CMS fields in the payload.
export function toPostSummary(post: SitePost): SitePostSummary {
  const { path, date, title, summary, tags } = post
  return { path, date, title, summary, tags }
}
