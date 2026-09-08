import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { notFound } from 'next/navigation'
import NotFound from '../app/(site)/not-found'
import ArticleNotFound from '../app/(site)/blog/[...slug]/not-found'
import MissingPage from '../app/(site)/[...missing]/page'

jest.mock('next/navigation', () => ({ notFound: jest.fn() }))

describe('Missing-page recovery', () => {
  it('provides clear copy and native Blog and Home recovery links', () => {
    render(<NotFound />)

    expect(screen.getByRole('heading', { level: 1, name: '404' })).toBeVisible()
    expect(
      screen.getByText('This page could not be found. Browse the blog or return home.')
    ).toBeVisible()
    expect(screen.getAllByRole('link')).toHaveLength(2)
    for (const [name, href] of [
      ['Browse blog', '/blog'],
      ['Home', '/'],
    ]) {
      const link = screen.getByRole('link', { name })
      expect(link.tagName).toBe('A')
      expect(link).toHaveAttribute('href', href)
      expect(link).not.toHaveAttribute('target')
      expect(link).not.toHaveAttribute('download')
      expect(link.querySelector('button')).toBeNull()
    }
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('main')).not.toBeInTheDocument()
  })

  it('tabs from Blog to Home and back', async () => {
    const user = userEvent.setup()
    render(<NotFound />)

    await user.tab()
    expect(screen.getByRole('link', { name: 'Browse blog' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('link', { name: 'Browse blog' })).toHaveFocus()
  })

  it('shares the recovery view with the article boundary', () => {
    expect(ArticleNotFound).toBe(NotFound)
  })

  it('delegates unmatched paths to the framework not-found signal', () => {
    const signal = new Error('NEXT_HTTP_ERROR_FALLBACK;404')
    jest.mocked(notFound).mockImplementationOnce(() => {
      throw signal
    })
    expect(() => MissingPage()).toThrow(signal)
    expect(notFound).toHaveBeenCalledTimes(1)
  })
})
