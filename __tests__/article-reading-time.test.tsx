import { render, screen } from '@testing-library/react'
import PostLayout from '@/layouts/PostLayout'
import PostSimple from '@/layouts/PostSimple'
import PostBanner from '@/layouts/PostBanner'
import type { SitePost } from '../src/payload/types'

jest.mock('@/components/Comments', () => () => null)
jest.mock('@/components/ScrollTopAndComment', () => () => null)
jest.mock(
  '@/components/PostSubscribeBox',
  () =>
    function MockPostSubscribeBox() {
      return <button>Subscribe</button>
    }
)
jest.mock('github-slugger', () => ({ slug: (value: string) => value.toLowerCase() }))
// Pliny's ESM-only utilities are outside this suite's metadata-rendering contract.
jest.mock('pliny/utils/formatDate', () => ({
  formatDate: (date: string, locale: string) => new Date(date).toLocaleDateString(locale),
}))
jest.mock('pliny/ui/Bleed', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const post: SitePost = {
  id: 'reading-time',
  slug: 'reading-time',
  path: 'blog/reading-time',
  filePath: '',
  title: 'An article with reading time',
  summary: 'Summary',
  date: '2026-05-25T12:00:00.000Z',
  tags: [],
  authors: [],
  images: [],
  draft: false,
}

for (const Layout of [PostLayout, PostSimple, PostBanner]) {
  describe(
    Layout === PostLayout ? 'PostLayout' : Layout === PostSimple ? 'PostSimple' : 'PostBanner',
    () => {
      it.each([undefined, 1, 4, 120])(
        'renders optional reading time %p without changing article content',
        (readingTimeMinutes) => {
          const { container } = render(
            <Layout
              content={{ ...post, readingTimeMinutes }}
              authorDetails={[{ slug: 'author', name: 'Article Author' }]}
              prev={{ path: 'blog/previous', title: 'Previous article' }}
              next={{ path: 'blog/next', title: 'Next article' }}
            >
              <p>Full article body</p>
            </Layout>
          )
          expect(screen.getByRole('heading', { level: 1, name: post.title })).toBeVisible()
          expect(screen.getByText('Full article body')).toBeVisible()
          expect(screen.getByRole('button', { name: 'Subscribe' })).toBeVisible()
          expect(screen.getByRole('link', { name: /Previous article/ })).toHaveAttribute(
            'href',
            '/blog/previous'
          )
          expect(screen.getByRole('link', { name: /Next article/ })).toHaveAttribute(
            'href',
            '/blog/next'
          )
          if (Layout === PostLayout) expect(screen.getByText('Article Author')).toBeVisible()
          const date = container.querySelector('time')
          if (Layout === PostBanner) {
            expect(date).toBeNull()
          } else {
            expect(date).toHaveAttribute('datetime', post.date)
            expect(date).not.toBeEmptyDOMElement()
            expect(date?.closest('dl')).toHaveClass('flex-wrap')
          }
          if (readingTimeMinutes === undefined) {
            expect(container.querySelector('[data-reading-time]')).toBeNull()
            expect(screen.queryByText(/min read/)).not.toBeInTheDocument()
            expect(screen.queryByText('Estimated reading time')).not.toBeInTheDocument()
            if (date) expect(date.closest('dl')?.querySelectorAll('dd')).toHaveLength(1)
          } else {
            const labels = container.querySelectorAll('[data-reading-time]')
            expect(labels).toHaveLength(1)
            expect(labels[0]).toHaveTextContent(`${readingTimeMinutes} min read`)
            expect(labels[0]).toBeVisible()
            expect(labels[0]).toHaveClass('text-gray-500', 'dark:text-gray-400')
            if (Layout === PostBanner) {
              expect(labels[0]).toHaveAttribute(
                'aria-label',
                `Estimated reading time: ${readingTimeMinutes} ${readingTimeMinutes === 1 ? 'minute' : 'minutes'}`
              )
            } else {
              expect(labels[0].previousElementSibling).toHaveTextContent('Estimated reading time')
              expect(labels[0].closest('dl')).toBe(date?.closest('dl'))
            }
          }
        }
      )
    }
  )
}
