import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Footer from '@/components/Footer'
import siteMetadata from '@/data/siteMetadata'

describe('Footer', () => {
  it('exposes one named RSS link with native same-tab navigation', () => {
    render(<Footer />)

    const footer = within(screen.getByRole('contentinfo'))
    const links = footer.getAllByRole('link', { name: 'RSS' })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/feed.xml')
    expect(links[0]).not.toHaveAttribute('target')
    expect(links[0]).not.toHaveAttribute('download')
  })

  it('preserves the home link, author, copyright, and attribution', () => {
    render(<Footer />)

    const footer = within(screen.getByRole('contentinfo'))
    expect(footer.getByRole('link', { name: siteMetadata.title })).toHaveAttribute('href', '/')
    expect(footer.getByText(siteMetadata.author)).toBeInTheDocument()
    expect(footer.getByText(`© ${new Date().getFullYear()}`)).toBeInTheDocument()
    expect(footer.getByText('Built with Codex and coffee in North Carolina')).toBeInTheDocument()
  })

  it('reaches RSS with Tab and returns to the home link with Shift+Tab', async () => {
    const user = userEvent.setup()
    render(<Footer />)

    const footer = within(screen.getByRole('contentinfo'))
    const home = footer.getByRole('link', { name: siteMetadata.title })
    const rss = footer.getByRole('link', { name: 'RSS' })
    await user.tab()
    expect(home).toHaveFocus()
    await user.tab()
    expect(rss).toHaveFocus()
    await user.tab({ shift: true })
    expect(home).toHaveFocus()
  })
})
