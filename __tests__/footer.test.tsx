import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Footer from '@/components/Footer'
import SectionContainer from '@/components/SectionContainer'
import siteMetadata from '@/data/siteMetadata'

describe('Footer', () => {
  it('retains the page-footer landmark inside the real site SectionContainer', () => {
    render(
      <SectionContainer>
        <main>Page content</main>
        <Footer />
      </SectionContainer>
    )

    const landmarks = screen.getAllByRole('contentinfo')
    expect(landmarks).toHaveLength(1)
    const footer = landmarks[0]
    expect(footer).toHaveAttribute('role', 'contentinfo')
    expect(footer.parentElement?.tagName).toBe('SECTION')
    expect(screen.getByRole('main').nextElementSibling).toBe(footer)
    expect(within(footer).getByRole('link', { name: 'RSS' })).toHaveAttribute('href', '/feed.xml')
  })

  it('exposes one named RSS link with native same-tab navigation', () => {
    render(<Footer />, { wrapper: SectionContainer })

    const footer = within(screen.getByRole('contentinfo'))
    const links = footer.getAllByRole('link', { name: 'RSS' })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/feed.xml')
    expect(links[0]).not.toHaveAttribute('target')
    expect(links[0]).not.toHaveAttribute('download')
  })

  it('preserves the home link, author, copyright, and attribution', () => {
    render(<Footer />, { wrapper: SectionContainer })

    const footer = within(screen.getByRole('contentinfo'))
    expect(footer.getByRole('link', { name: siteMetadata.title })).toHaveAttribute('href', '/')
    expect(footer.getByText(siteMetadata.author)).toBeInTheDocument()
    expect(footer.getByText(`© ${new Date().getFullYear()}`)).toBeInTheDocument()
    expect(footer.getByText('Built with Codex and coffee in North Carolina')).toBeInTheDocument()
  })

  it('reaches RSS with Tab and returns to the home link with Shift+Tab', async () => {
    const user = userEvent.setup()
    render(<Footer />, { wrapper: SectionContainer })

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
