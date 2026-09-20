import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import PostLayout from '@/layouts/PostLayout'
import PostSimple from '@/layouts/PostSimple'
import PostBanner from '@/layouts/PostBanner'
import siteMetadata from '@/data/siteMetadata'
import type { SitePost } from '../src/payload/types'

jest.mock('@/components/Comments', () => ({
  __esModule: true,
  default: ({ slug }: { slug: string }) => <a href="#comment">Comments for {slug}</a>,
}))
jest.mock('@/components/ScrollTopAndComment', () => () => null)
jest.mock(
  '@/components/PostSubscribeBox',
  () =>
    function MockSubscribe() {
      return <button>Subscribe</button>
    }
)
jest.mock('github-slugger', () => ({ slug: (value: string) => value.toLowerCase() }))
jest.mock('pliny/utils/formatDate', () => ({
  formatDate: (date: string, locale: string) => new Date(date).toLocaleDateString(locale),
}))
jest.mock('pliny/ui/Bleed', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const path = `blog/日本語/${'nested/'.repeat(12)}article%2Fpart?tracking=yes#section`
const canonical = `${new URL(siteMetadata.siteUrl).origin}/${path.split('?')[0]}`
const post: SitePost = {
  id: 'copy-layout',
  slug: 'copy-layout',
  path,
  filePath: '',
  legacySourcePath: 'blog/original.mdx',
  title: 'Copy this article',
  summary: 'An article summary',
  date: '2026-05-25T12:00:00.000Z',
  tags: [],
  authors: [],
  images: [],
  draft: false,
  readingTimeMinutes: 4,
}
const layouts = [
  { name: 'PostLayout', Layout: PostLayout },
  { name: 'PostSimple', Layout: PostSimple },
  { name: 'PostBanner', Layout: PostBanner },
]
let originalClipboard: PropertyDescriptor | undefined

beforeEach(() => {
  originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
})

afterEach(() => {
  cleanup()
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

for (const { name, Layout } of layouts) {
  describe(name, () => {
    it.each([false, true])(
      'copies the canonical URL and supports keyboard fallback with adjacent articles: %p',
      async (withNavigation) => {
        const user = userEvent.setup()
        const writeText = jest
          .fn<ReturnType<Clipboard['writeText']>, Parameters<Clipboard['writeText']>>()
          .mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText } satisfies Pick<Clipboard, 'writeText'>,
        })
        const { container } = render(
          <Layout
            content={post}
            authorDetails={[{ slug: 'author', name: 'Article Author' }]}
            prev={withNavigation ? { path: 'blog/previous', title: 'Previous article' } : undefined}
            next={withNavigation ? { path: 'blog/next', title: 'Next article' } : undefined}
          >
            <p>The original article body</p>
          </Layout>
        )
        const buttons = screen.getAllByRole('button', { name: 'Copy article link' })
        expect(buttons).toHaveLength(1)
        const button = buttons[0]
        const status = screen.getByRole('status')
        expect(status).toHaveAttribute('aria-atomic', 'true')
        expect(status).toBeEmptyDOMElement()
        expect(screen.getByRole('heading', { name: post.title })).toBeVisible()
        expect(screen.getByText('The original article body')).toBeVisible()
        expect(screen.getByText('4 min read')).toBeVisible()
        expect(screen.getByRole('button', { name: 'Subscribe' })).toBeVisible()
        expect(container.querySelector('#comment')).toHaveTextContent('Comments for copy-layout')
        if (name === 'PostLayout') {
          expect(screen.getByRole('link', { name: 'View on GitHub' })).toHaveAttribute(
            'href',
            `${siteMetadata.siteRepo}/blob/main/data/blog/original.mdx`
          )
          expect(screen.getByRole('link', { name: 'Discuss on Twitter' })).toBeVisible()
        }
        for (const direction of ['Previous', 'Next']) {
          const link = screen.queryByRole('link', { name: new RegExp(`${direction} article`) })
          if (withNavigation) {
            expect(link).toHaveAttribute('href', `/blog/${direction.toLowerCase()}`)
          } else {
            expect(link).not.toBeInTheDocument()
          }
        }

        button.focus()
        await user.keyboard('{Enter}')
        expect(writeText).toHaveBeenLastCalledWith(canonical)
        expect(status).toHaveTextContent(/^Article link copied\.$/)
        await user.keyboard(' ')
        expect(status).toHaveTextContent('Article link copied again (2).')
        expect(button).toHaveFocus()
        expect(button).toHaveAccessibleName('Copy article link')

        writeText.mockRejectedValueOnce(new Error('Clipboard denied'))
        await user.keyboard('{Enter}')
        const fallback = screen.getByRole('textbox', { name: 'Article link' })
        expect(fallback).toHaveValue(canonical)
        expect(fallback).toHaveFocus()
        expect(fallback).toHaveAttribute('readonly')
        expect(fallback).toHaveAccessibleDescription(/Copy this link manually/)
        expect(fallback).toBeInstanceOf(HTMLTextAreaElement)
        if (!(fallback instanceof HTMLTextAreaElement)) throw new Error('Expected URL textarea')
        expect([fallback.selectionStart, fallback.selectionEnd]).toEqual([0, canonical.length])
        expect(status).toHaveTextContent('Could not copy the article link.')
        await user.tab()
        expect(screen.getByRole('link', { name: 'Comments for copy-layout' })).toHaveFocus()
        await user.tab({ shift: true })
        expect(fallback).toHaveFocus()
        await user.tab({ shift: true })
        expect(button).toHaveFocus()
        await user.keyboard('{Enter}')
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
        expect(status).toHaveTextContent('Article link copied again (3).')
        expect(writeText).toHaveBeenCalledTimes(4)
      }
    )
  })
}
