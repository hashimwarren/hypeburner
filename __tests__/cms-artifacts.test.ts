import { buildRssXml, buildSearchDocuments, buildTagData, getTagSlug } from '../lib/cms/artifacts'
import type { CmsPost } from '../lib/cms/types'

function post(overrides: Partial<CmsPost>): CmsPost {
  return {
    id: overrides.slug || 'post',
    slug: overrides.slug || 'post',
    path: `blog/${overrides.slug || 'post'}`,
    filePath: `blog/${overrides.slug || 'post'}.mdx`,
    title: overrides.title || 'Post',
    summary: overrides.summary || '',
    date: overrides.date || '2026-01-01T12:00:00.000Z',
    lastmod: overrides.lastmod || overrides.date || '2026-01-01T12:00:00.000Z',
    tags: overrides.tags || [],
    authors: overrides.authors || [],
    images: overrides.images || [],
    draft: overrides.draft ?? false,
    ...overrides,
  }
}

describe('CMS artifacts', () => {
  const posts = [
    post({
      slug: 'newsletter/older-published',
      title: 'Older Published',
      date: '2026-01-01T12:00:00.000Z',
      tags: ['LaunchDarkly'],
    }),
    post({
      slug: 'news/draft-post',
      title: 'Draft Post',
      date: '2026-03-01T12:00:00.000Z',
      tags: ['Draft'],
      draft: true,
    }),
    post({
      slug: 'newsletter/latest-published',
      title: 'Latest Published',
      date: '2026-02-01T12:00:00.000Z',
      tags: ['WorkOS', 'auth.md'],
    }),
  ]

  it('builds search documents from published posts only, newest first', () => {
    expect(buildSearchDocuments(posts).map((entry) => entry.slug)).toEqual([
      'newsletter/latest-published',
      'newsletter/older-published',
    ])
    expect(buildSearchDocuments(posts)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: 'news/draft-post' })])
    )
  })

  it('builds RSS from published posts only', () => {
    const rss = buildRssXml(posts)

    expect(rss).toContain('/blog/newsletter/latest-published')
    expect(rss).toContain('<title>Latest Published</title>')
    expect(rss).not.toContain('/blog/news/draft-post')
    expect(rss).not.toContain('Draft Post')
  })

  it('builds tag data from published posts only', () => {
    expect(buildTagData(posts)).toEqual({
      authmd: 1,
      launchdarkly: 1,
      workos: 1,
    })
    expect(buildTagData(posts)).not.toHaveProperty('auth-md')
  })

  it('matches github-slugger tag slugs used by tag pages', () => {
    expect(getTagSlug('auth.md')).toBe('authmd')
    expect(getTagSlug('foo & bar')).toBe('foo--bar')
  })
})
