import type { SiteAuthor, SitePost } from '../../src/payload/types'

export type CmsPost = SitePost
export type CmsAuthor = SiteAuthor
export type CmsTagCounts = Record<string, number>

export type CmsQueryContext = {
  operation: string
  collection?: string
}

export class CmsQueryError extends Error {
  context: CmsQueryContext
  cause: unknown

  constructor(message: string, context: CmsQueryContext, cause: unknown) {
    super(message)
    this.name = 'CmsQueryError'
    this.context = context
    this.cause = cause
  }
}
