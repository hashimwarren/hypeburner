import { render, screen, within } from '@testing-library/react'
import { notFound, usePathname } from 'next/navigation'
import * as Blog from '../app/(site)/blog/page'
import * as BlogPage from '../app/(site)/blog/page/[page]/page'
import * as Tag from '../app/(site)/tags/[tag]/page'
import * as TagPage from '../app/(site)/tags/[tag]/page/[page]/page'
import { getAllPosts, getTagCounts } from '../lib/cms'
import { toPostSummary } from '../lib/cms/post-summary'
import type { SitePost } from '../src/payload/types'

jest.mock('../lib/cms', () => ({ getAllPosts: jest.fn(), getTagCounts: jest.fn() }))
jest.mock('next/navigation', () => ({ notFound: jest.fn(), usePathname: jest.fn() }))
jest.mock('github-slugger', () => ({
  slug: (value: string) => value.toLowerCase().replace(/ /g, '-'),
}))
jest.mock('pliny/utils/formatDate', () => ({
  formatDate: (date: string, locale: string) => new Date(date).toLocaleDateString(locale),
}))

const posts: SitePost[] = Array.from({ length: 13 }, (_, index) => ({
  id: index,
  slug: `newsletter/post-${index}`,
  path: `blog/newsletter/post-${index}`,
  filePath: `blog/newsletter/post-${index}.mdx`,
  title: `Post ${index}`,
  summary: `Summary ${index}`,
  date: '2026-05-25T12:00:00.000Z',
  tags: index === 1 ? ['Other'] : ['Developer Tools'],
  authors: [{ slug: 'editor', name: 'Editor', bioRichText: { text: 'Author biography' } }],
  images: ['/image.jpg'],
  content: { root: { children: [{ type: 'text', text: `Article body ${index}` }] } },
  sourceMarkdown: `# Markdown body ${index}`,
  structuredData: { articleBody: `Structured article ${index}` },
  draft: false,
}))
const taggedPosts = posts.filter((post) => post.tags.includes('Developer Tools'))
const tagCounts = { 'Developer Tools': 12, Other: 1 }
const summaryKeys = ['date', 'path', 'summary', 'tags', 'title']

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getAllPosts).mockResolvedValue(posts)
  jest.mocked(getTagCounts).mockResolvedValue(tagCounts)
  jest.mocked(usePathname).mockReturnValue('/blog')
  jest.mocked(notFound).mockImplementation(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  })
})

const routes = [
  {
    name: 'blog first page',
    pathname: '/blog',
    load: () => Blog.default({ searchParams: Promise.resolve({ page: '1' }) }),
    expected: posts.slice(0, 5),
    currentPage: 1,
    title: 'All Posts',
  },
  {
    name: 'blog middle page',
    pathname: '/blog/page/2',
    load: () => BlogPage.default({ params: Promise.resolve({ page: '2' }) }),
    expected: posts.slice(5, 10),
    currentPage: 2,
    title: 'All Posts',
  },
  {
    name: 'blog last page',
    pathname: '/blog/page/3',
    load: () => BlogPage.default({ params: Promise.resolve({ page: '3' }) }),
    expected: posts.slice(10),
    currentPage: 3,
    title: 'All Posts',
  },
  {
    name: 'tag first page',
    pathname: '/tags/developer-tools',
    load: () => Tag.default({ params: Promise.resolve({ tag: 'developer-tools' }) }),
    expected: taggedPosts.slice(0, 5),
    currentPage: 1,
    title: 'Developer-tools',
  },
  {
    name: 'tag middle page',
    pathname: '/tags/developer-tools/page/2',
    load: () => TagPage.default({ params: Promise.resolve({ tag: 'developer-tools', page: '2' }) }),
    expected: taggedPosts.slice(5, 10),
    currentPage: 2,
    title: 'Developer-tools',
  },
  {
    name: 'tag last page',
    pathname: '/tags/developer-tools/page/3',
    load: () => TagPage.default({ params: Promise.resolve({ tag: 'developer-tools', page: '3' }) }),
    expected: taggedPosts.slice(10),
    currentPage: 3,
    title: 'Developer-tools',
  },
]

describe('archive client payloads', () => {
  it('selects an explicit field allowlist without mutating full article data', () => {
    const post = { ...posts[0], futureCmsField: 'Do not serialize me' }
    const before = JSON.stringify(post)
    const summary = toPostSummary(post)
    expect(Object.keys(summary).sort()).toEqual(summaryKeys)
    expect(summary).toEqual({
      path: post.path,
      date: post.date,
      title: post.title,
      summary: post.summary,
      tags: post.tags,
    })
    expect(JSON.stringify(post)).toBe(before)
    expect(summary).not.toBe(post)
    expect(toPostSummary({ ...post, summary: '', tags: [] })).toMatchObject({
      summary: '',
      tags: [],
    })
  })

  it.each(routes)(
    '$name only passes the visible summaries and complete pagination/counts',
    async (route) => {
      const before = JSON.stringify(posts)
      const element = await route.load()
      const props = JSON.parse(JSON.stringify(element.props))
      expect(Object.keys(props).sort()).toEqual(['pagination', 'posts', 'tagCounts', 'title'])
      expect(props.posts).toEqual(route.expected.map(toPostSummary))
      for (const post of props.posts) expect(Object.keys(post).sort()).toEqual(summaryKeys)
      expect(props.pagination).toEqual({ currentPage: route.currentPage, totalPages: 3 })
      expect(props.tagCounts).toEqual(tagCounts)
      expect(props.title).toBe(route.title)
      expect(JSON.stringify(posts)).toBe(before)
    }
  )

  it.each(routes)(
    '$name preserves article links, summaries, dates, tags and pagination',
    async (route) => {
      jest.mocked(usePathname).mockReturnValue(route.pathname)
      const { container } = render(await route.load())
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(route.title)
      const articles = screen.getAllByRole('article')
      expect(articles).toHaveLength(route.expected.length)
      route.expected.forEach((post, index) => {
        const article = within(articles[index])
        expect(article.getByRole('link', { name: post.title })).toHaveAttribute(
          'href',
          `/${post.path}`
        )
        expect(article.getByText(post.summary)).toBeVisible()
        expect(articles[index].querySelector('time')).toHaveAttribute('datetime', post.date)
        for (const tag of post.tags) {
          expect(article.getByRole('link', { name: tag.replace(/ /g, '-') })).toHaveAttribute(
            'href',
            `/tags/${tag.toLowerCase().replace(/ /g, '-')}`
          )
        }
      })
      expect(screen.getByText('Developer Tools (12)')).toBeVisible()
      expect(screen.getByText('Other (1)')).toBeVisible()
      expect(screen.getByText(`${route.currentPage} of 3`)).toBeVisible()
      const base = route.pathname.startsWith('/blog') ? '/blog' : '/tags/developer-tools'
      if (route.currentPage === 1) {
        expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
      } else {
        expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
          'href',
          route.currentPage === 2 ? base : `${base}/page/${route.currentPage - 1}`
        )
      }
      if (route.currentPage === 3) {
        expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
      } else {
        expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
          'href',
          `${base}/page/${route.currentPage + 1}`
        )
      }
      expect(container).not.toHaveTextContent('Article body')
    }
  )

  it('preserves empty archives without falling back to unrelated posts', async () => {
    const tag = await Tag.default({ params: Promise.resolve({ tag: 'missing' }) })
    expect(tag.props.posts).toEqual([])
    expect(tag.props.pagination).toEqual({ currentPage: 1, totalPages: 0 })
    jest.mocked(getAllPosts).mockResolvedValue([])
    const blog = await Blog.default({ searchParams: Promise.resolve({ page: '1' }) })
    expect(blog.props.posts).toEqual([])
    expect(blog.props.pagination).toEqual({ currentPage: 1, totalPages: 0 })
    render(blog)
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('renders a single-page tag without pagination', async () => {
    jest.mocked(usePathname).mockReturnValue('/tags/other')
    const page = await Tag.default({ params: Promise.resolve({ tag: 'other' }) })
    expect(page.props.posts).toEqual([toPostSummary(posts[1])])
    expect(page.props.pagination).toEqual({ currentPage: 1, totalPages: 1 })
    render(page)
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('does not serialize unrelated article edits or off-page summaries', async () => {
    const load = () => Blog.default({ searchParams: Promise.resolve({ page: '1' }) })
    const before = JSON.stringify((await load()).props)
    jest.mocked(getAllPosts).mockResolvedValue(
      posts.map((post, index) => ({
        ...post,
        content: { root: { text: 'Updated full body' } },
        sourceMarkdown: 'Updated Markdown',
        authors: [{ slug: 'updated-author', name: 'Updated Author' }],
        summary: index >= 5 ? 'Updated off-page summary' : post.summary,
      }))
    )
    expect(JSON.stringify((await load()).props)).toBe(before)
  })

  it.each(['0', '-1', '4', 'not-a-number'])('preserves 404s for invalid page %s', async (page) => {
    await expect(BlogPage.default({ params: Promise.resolve({ page }) })).rejects.toThrow('404')
    await expect(
      TagPage.default({ params: Promise.resolve({ tag: 'developer-tools', page }) })
    ).rejects.toThrow('404')
  })

  it('preserves 404s for missing tag pages and empty numbered blog pages', async () => {
    await expect(
      TagPage.default({ params: Promise.resolve({ tag: 'missing', page: '1' }) })
    ).rejects.toThrow('404')
    jest.mocked(getAllPosts).mockResolvedValue([])
    await expect(BlogPage.default({ params: Promise.resolve({ page: '1' }) })).rejects.toThrow(
      '404'
    )
  })

  it('retains all static page paths and daily revalidation', async () => {
    expect(await BlogPage.generateStaticParams()).toEqual([
      { page: '1' },
      { page: '2' },
      { page: '3' },
    ])
    expect(await Tag.generateStaticParams()).toEqual([{ tag: 'developer-tools' }, { tag: 'other' }])
    expect(await TagPage.generateStaticParams()).toEqual([
      { tag: 'developer-tools', page: '1' },
      { tag: 'developer-tools', page: '2' },
      { tag: 'developer-tools', page: '3' },
      { tag: 'other', page: '1' },
    ])
    for (const route of [Blog, BlogPage, Tag, TagPage]) {
      expect(route.dynamic).toBe('force-static')
      expect(route.revalidate).toBe(86400)
    }
    expect(Blog.metadata.title).toBe('Blog')
    expect(
      await Tag.generateMetadata({ params: Promise.resolve({ tag: 'developer-tools' }) })
    ).toMatchObject({
      title: 'developer-tools',
      alternates: { canonical: './' },
    })
  })
})
