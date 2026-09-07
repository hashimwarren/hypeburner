import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ScrollTopAndComment from '@/components/ScrollTopAndComment'
import siteMetadata from '@/data/siteMetadata'

jest.mock('@/data/siteMetadata', () => ({ comments: { provider: 'giscus' } }))

describe('ScrollTopAndComment', () => {
  const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY')!
  const originalComments = siteMetadata.comments

  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true })
  })

  afterEach(() => {
    cleanup()
    jest.restoreAllMocks()
    Object.defineProperty(window, 'scrollY', originalScrollY)
    siteMetadata.comments = originalComments
  })

  it.each([0, 50, 51, 100])('initializes visibility at scrollY=%i without a scroll event', (y) => {
    window.scrollY = y
    render(<ScrollTopAndComment />)

    const controls = screen.getByRole('button', { name: 'Scroll To Top' }).parentElement
    expect(controls).toHaveClass(y > 50 ? 'flex' : 'hidden')
    expect(controls).not.toHaveClass(y > 50 ? 'hidden' : 'flex')
    expect(controls).not.toHaveClass('md:flex')
    expect(controls).not.toHaveClass('md:hidden')
    expect(controls).toHaveAttribute('data-article-scroll-controls')
  })

  it('tracks the strict 50px threshold in both directions', () => {
    render(<ScrollTopAndComment />)
    const controls = screen.getByRole('button', { name: 'Scroll To Top' }).parentElement

    for (const y of [0, 50, 51, 100, 0]) {
      window.scrollY = y
      fireEvent.scroll(window)
      expect(controls).toHaveClass(y > 50 ? 'flex' : 'hidden')
      expect(controls).not.toHaveClass(y > 50 ? 'hidden' : 'flex')
    }
  })

  it('keeps the existing named top action and mobile touch-target classes', () => {
    window.scrollY = 100
    const scrollTo = jest.spyOn(window, 'scrollTo').mockImplementation(() => {})
    render(<ScrollTopAndComment />)

    const top = screen.getByRole('button', { name: 'Scroll To Top' })
    expect(top).toHaveClass('p-3', 'md:p-2')
    fireEvent.click(top)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
  })

  it('keeps comment navigation desktop-only and scrolls to the existing anchor', () => {
    window.scrollY = 100
    const { container } = render(
      <>
        <ScrollTopAndComment />
        <div id="comment" />
      </>
    )
    const target = container.querySelector('#comment')!
    const scrollIntoView = jest.fn()
    Object.defineProperty(target, 'scrollIntoView', { value: scrollIntoView })

    const comment = screen.getByRole('button', { name: 'Scroll To Comment' })
    expect(comment).toHaveClass('hidden', 'md:block')
    fireEvent.click(comment)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('allows comment activation when no anchor exists', () => {
    window.scrollY = 100
    render(<ScrollTopAndComment />)
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Scroll To Comment' }))
    ).not.toThrow()
  })

  it('omits the comment action when no provider is configured', () => {
    siteMetadata.comments = undefined
    window.scrollY = 100
    render(<ScrollTopAndComment />)
    expect(screen.queryByRole('button', { name: 'Scroll To Comment' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scroll To Top' })).toBeInTheDocument()
  })

  it('removes the registered scroll listener on unmount', () => {
    const add = jest.spyOn(window, 'addEventListener')
    const remove = jest.spyOn(window, 'removeEventListener')
    const { unmount } = render(<ScrollTopAndComment />)
    const registrations = add.mock.calls.filter(([type]) => type === 'scroll')
    expect(registrations).toHaveLength(1)

    unmount()
    expect(remove).toHaveBeenCalledWith('scroll', registrations[0][1])
  })
})
