import { render, screen } from '@testing-library/react'
import PostLayout from '@/layouts/PostLayout'
import siteMetadata from '@/data/siteMetadata'
import type { SitePost } from '../src/payload/types'

jest.mock('@/components/Comments', () => ({
  __esModule: true,
  default: ({ slug }: { slug: string }) => <div data-testid="comments">{slug}</div>,
}))
jest.mock('@/components/ScrollTopAndComment', () => () => null)
jest.mock('@/components/PostSubscribeBox', () => () => null)
jest.mock('github-slugger', () => ({ slug: (value: string) => value.toLowerCase() }))

const post: SitePost = {
  id: 'cms-native',
  slug: '2026-05-25',
  path: 'blog/2026-05-25',
  filePath: 'blog/2026-05-25.mdx',
  title: 'CMS-native article',
  summary: 'A post without repository provenance',
  date: '2026-05-25T12:00:00.000Z',
  tags: ['CMS'],
  authors: [],
  images: [],
  draft: false,
}

function renderPost(legacySourcePath?: string) {
  return render(
    <PostLayout
      content={{ ...post, legacySourcePath }}
      authorDetails={[{ slug: 'default', name: 'Author' }]}
      prev={{ path: 'blog/previous', title: 'Previous post' }}
      next={{ path: 'blog/next', title: 'Next post' }}
    >
      <p>Article body stays visible</p>
    </PostLayout>
  )
}

describe('article source footer', () => {
  it.each([
    undefined,
    '',
    '   ',
    'blog/../post.mdx',
    '/blog/post.mdx',
    'https://host/blog/post.mdx',
    'blog/%2e%2e/post.mdx',
    'blog/post.mdx#fragment',
    'blog/post.mdx?raw=1',
    'blog/po\\st.mdx',
    'blog/post.mdx\n',
    'blog/\ud800.mdx',
  ])('omits the link and separator for %p despite stale filePath', (legacySourcePath) => {
    renderPost(legacySourcePath)
    expect(screen.queryByRole('link', { name: 'View on GitHub' })).not.toBeInTheDocument()
    const discuss = screen.getByRole('link', { name: 'Discuss on Twitter' })
    expect(discuss.parentElement?.textContent).toBe('Discuss on Twitter')
  })

  it.each([
    ['data/blog/news/legacy.mdx', 'blog/news/legacy.mdx'],
    ['blog/legacy.md', 'blog/legacy.md'],
    [' data/blog/日本語/hello world.mdx ', 'blog/%E6%97%A5%E6%9C%AC%E8%AA%9E/hello%20world.mdx'],
  ])('renders one encoded source link and separator from %p', (legacySourcePath, expected) => {
    renderPost(legacySourcePath)
    const links = screen.getAllByRole('link', { name: 'View on GitHub' })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', `${siteMetadata.siteRepo}/blob/main/data/${expected}`)
    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer')
    expect(links[0].parentElement?.textContent).toBe('Discuss on Twitter • View on GitHub')
  })

  it.each([undefined, 'data/blog/news/legacy.mdx'])(
    'preserves article content and navigation for %p',
    (source) => {
      renderPost(source)
      expect(screen.getByRole('heading', { name: post.title })).toBeInTheDocument()
      expect(screen.getByText('Article body stays visible')).toBeInTheDocument()
      expect(screen.getByText('Author')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Discuss on Twitter' })).toHaveAttribute(
        'href',
        `https://mobile.twitter.com/search?q=${encodeURIComponent(`${siteMetadata.siteUrl}/${post.path}`)}`
      )
      expect(screen.getByRole('link', { name: 'Discuss on Twitter' })).toHaveAttribute(
        'rel',
        'nofollow'
      )
      expect(screen.getByRole('link', { name: 'Previous post' })).toHaveAttribute(
        'href',
        '/blog/previous'
      )
      expect(screen.getByRole('link', { name: 'Next post' })).toHaveAttribute('href', '/blog/next')
      expect(screen.getByRole('link', { name: 'Back to the blog' })).toHaveAttribute(
        'href',
        '/blog'
      )
      expect(screen.getByRole('link', { name: 'CMS' })).toHaveAttribute('href', '/tags/cms')
      if (siteMetadata.comments) expect(screen.getByTestId('comments')).toHaveTextContent(post.slug)
    }
  )
})
