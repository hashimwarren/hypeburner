import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CopyArticleLink from '@/components/CopyArticleLink'

const url = 'https://hypeburner.com/notes/blog/%E6%97%A5%E6%9C%AC%E8%AA%9E/nested/a%252Fb%3Fc%23d'
const buttonName = 'Copy article link'

function writeMock() {
  return jest.fn<ReturnType<Clipboard['writeText']>, Parameters<Clipboard['writeText']>>()
}

function installClipboard(clipboard: Partial<Pick<Clipboard, 'writeText'>> | undefined) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
}

function deferredWrite() {
  let resolve!: () => void
  let reject!: (reason: Error) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('CopyArticleLink', () => {
  let originalClipboard: PropertyDescriptor | undefined

  beforeEach(() => {
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  })

  afterEach(() => {
    cleanup()
    jest.restoreAllMocks()
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
    else Reflect.deleteProperty(navigator, 'clipboard')
  })

  it('renders a stable native button, empty mounted status, and scoped responsive focus styles', () => {
    const writeText = writeMock().mockResolvedValue(undefined)
    installClipboard({ writeText })
    render(<CopyArticleLink url={url} />)

    const button = screen.getByRole('button', { name: buttonName })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass(
      'min-h-[44px]',
      'min-w-[44px]',
      'max-w-full',
      'whitespace-normal',
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-primary-500',
      'dark:focus-visible:outline-primary-400',
      'dark:bg-gray-800'
    )
    expect(button.parentElement).toHaveClass('min-w-0', 'max-w-full', 'flex-col')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('announces only after resolution and preserves button focus and name while pending', async () => {
    const user = userEvent.setup()
    const pending = deferredWrite()
    const writeText = writeMock().mockReturnValue(pending.promise)
    installClipboard({ writeText })
    render(<CopyArticleLink url={url} />)
    const button = screen.getByRole('button', { name: buttonName })
    const status = screen.getByRole('status')

    await user.tab()
    await user.keyboard('{Enter}')
    expect(writeText).toHaveBeenCalledWith(url)
    expect(status).toBeEmptyDOMElement()
    expect(button).toHaveFocus()
    expect(button).toHaveAccessibleName(buttonName)
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()

    await act(async () => pending.resolve())
    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent(/^Article link copied\.$/)
    expect(button).toHaveFocus()
    expect(button).toHaveAccessibleName(buttonName)
    expect(button).toHaveAttribute('aria-disabled', 'false')
    expect(writeText).toHaveBeenCalledTimes(1)
  })

  it('supports Tab, Shift+Tab, Enter and Space with distinct meaningful success announcements', async () => {
    const user = userEvent.setup()
    const writeText = writeMock().mockResolvedValue(undefined)
    installClipboard({ writeText })
    render(
      <>
        <button type="button">Before</button>
        <CopyArticleLink url={url} />
        <button type="button">After</button>
      </>
    )
    const button = screen.getByRole('button', { name: buttonName })
    const status = screen.getByRole('status')
    const initialLocation = window.location.href

    await user.tab()
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus()
    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard('{Enter}')
    const firstAnnouncement = status.textContent
    expect(firstAnnouncement).toBe('Article link copied.')
    expect(button).toHaveFocus()
    await user.keyboard(' ')
    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent(/^Article link copied again \(2\)\.$/)
    expect(status.textContent).not.toBe(firstAnnouncement)
    expect(button).toHaveAccessibleName(buttonName)
    expect(button).toHaveFocus()
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(writeText.mock.calls).toEqual([[url], [url]])
    expect(window.location.href).toBe(initialLocation)
    await user.tab()
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(button).toHaveFocus()
  })

  it('guards same-turn and keyboard attempts with one in-flight write, then permits another', async () => {
    const user = userEvent.setup()
    const pending = deferredWrite()
    const writeText = writeMock().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined)
    installClipboard({ writeText })
    render(<CopyArticleLink url={url} />)
    const button = screen.getByRole('button', { name: buttonName })
    await user.tab()
    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    await user.keyboard('{Enter} ')
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(button).toHaveFocus()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    await act(async () => pending.resolve())
    await user.keyboard('{Enter}')
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status')).toHaveTextContent('Article link copied again (2).')
  })

  it('does not steal focus back if the user tabs away during a successful write', async () => {
    const user = userEvent.setup()
    const pending = deferredWrite()
    installClipboard({ writeText: writeMock().mockReturnValue(pending.promise) })
    render(
      <>
        <CopyArticleLink url={url} />
        <button type="button">After</button>
      </>
    )
    await user.tab()
    await user.keyboard('{Enter}')
    await user.tab()
    const after = screen.getByRole('button', { name: 'After' })
    expect(after).toHaveFocus()
    await act(async () => pending.resolve())
    expect(after).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Article link copied.')
  })

  it.each(['missing clipboard', 'missing method', 'synchronous exception', 'rejected promise'])(
    'provides a labeled, selected, identical manual-copy URL after %s',
    async (failure) => {
      const user = userEvent.setup()
      const writeText = writeMock()
      if (failure === 'missing clipboard') installClipboard(undefined)
      else if (failure === 'missing method') installClipboard({})
      else {
        if (failure === 'synchronous exception') {
          writeText.mockImplementation(() => {
            throw new Error('Copy unavailable')
          })
        } else writeText.mockRejectedValue(new Error('Copy denied'))
        installClipboard({ writeText })
      }
      render(<CopyArticleLink url={url} />)
      const status = screen.getByRole('status')
      await user.click(screen.getByRole('button', { name: buttonName }))
      const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Article link' })

      expect(screen.getByRole('status')).toBe(status)
      expect(status).toHaveTextContent('Could not copy the article link.')
      expect(status).not.toHaveTextContent('Article link copied')
      expect(field.tagName).toBe('TEXTAREA')
      expect(screen.getByLabelText('Article link')).toBe(field)
      expect(field).toHaveAttribute('readonly')
      expect(field).toHaveValue(url)
      expect(field).toHaveAccessibleDescription(
        /Copy this link manually: press Ctrl\+C or Command\+C/
      )
      expect(field).toHaveAccessibleDescription(/touch and hold it to select and copy/)
      expect(field).toHaveFocus()
      expect(field.selectionStart).toBe(0)
      expect(field.selectionEnd).toBe(url.length)
      expect(field).toHaveClass('w-full', 'min-w-0', 'max-w-full', 'break-all', 'focus:outline-2')
      expect(screen.getByRole('button', { name: buttonName })).not.toBeDisabled()
      expect(screen.getByRole('button', { name: buttonName })).toHaveAttribute(
        'aria-disabled',
        'false'
      )
      if (failure === 'missing clipboard' || failure === 'missing method') {
        expect(writeText).not.toHaveBeenCalled()
      } else {
        expect(writeText).toHaveBeenCalledTimes(1)
        expect(writeText).toHaveBeenCalledWith(url)
      }
    }
  )

  it('waits for a pending rejection before focusing fallback and never announces success', async () => {
    const user = userEvent.setup()
    const pending = deferredWrite()
    installClipboard({ writeText: writeMock().mockReturnValue(pending.promise) })
    render(<CopyArticleLink url={url} />)
    const button = screen.getByRole('button', { name: buttonName })
    await user.click(button)
    expect(button).toHaveFocus()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    await act(async () => pending.reject(new Error('Denied after waiting')))
    expect(screen.getByRole('textbox', { name: 'Article link' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Could not copy the article link.')
  })

  it('keeps retry and surrounding controls reachable and removes fallback after successful retry', async () => {
    const user = userEvent.setup()
    installClipboard(undefined)
    render(
      <>
        <CopyArticleLink url={url} />
        <button type="button">After</button>
      </>
    )
    const button = screen.getByRole('button', { name: buttonName })
    await user.click(button)
    const field = screen.getByRole('textbox', { name: 'Article link' })
    expect(field).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(field).toHaveFocus()
    await user.tab({ shift: true })
    expect(button).toHaveFocus()
    const pending = deferredWrite()
    const writeText = writeMock().mockReturnValue(pending.promise)
    installClipboard({ writeText })
    await user.keyboard(' ')
    expect(field).toBeInTheDocument()
    expect(button).toHaveFocus()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    await act(async () => pending.resolve())
    expect(writeText).toHaveBeenCalledWith(url)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/Copy this link manually/)).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/^Article link copied\.$/)
    expect(button).toHaveFocus()
    expect(button).toHaveAccessibleName(buttonName)
  })

  it('refocuses and reselects an existing fallback on repeated failure, then permits success', async () => {
    const user = userEvent.setup()
    const writeText = writeMock()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue(undefined)
    installClipboard({ writeText })
    render(<CopyArticleLink url={url} />)
    const button = screen.getByRole('button', { name: buttonName })
    await user.click(button)
    const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Article link' })
    field.setSelectionRange(3, 3)
    await user.tab({ shift: true })
    expect(button).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('textbox', { name: 'Article link' })).toBe(field)
    expect(field).toHaveFocus()
    expect(field.selectionStart).toBe(0)
    expect(field.selectionEnd).toBe(url.length)
    expect(field).toHaveValue(url)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Could not copy the article link again (2).'
    )
    await user.tab({ shift: true })
    await user.keyboard('{Enter}')
    expect(writeText).toHaveBeenCalledTimes(3)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(/^Article link copied\.$/)
  })

  it.each(['unavailable', 'synchronous exception'])(
    'announces consecutive %s failures distinctly and reselects the fallback',
    async (failure) => {
      const user = userEvent.setup()
      installClipboard(
        failure === 'unavailable'
          ? undefined
          : {
              writeText: writeMock().mockImplementation(() => {
                throw new Error('Clipboard failed synchronously')
              }),
            }
      )
      render(<CopyArticleLink url={url} />)
      const button = screen.getByRole('button', { name: buttonName })
      const status = screen.getByRole('status')
      await user.click(button)
      const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Article link' })
      const firstAnnouncement = status.textContent
      expect(firstAnnouncement).toBe(
        'Could not copy the article link. Copy it manually below, or try again.'
      )
      field.setSelectionRange(3, 3)
      await user.tab({ shift: true })
      await user.keyboard('{Enter}')
      expect(screen.getByRole('status')).toBe(status)
      expect(status.textContent).not.toBe(firstAnnouncement)
      expect(status).toHaveTextContent('Could not copy the article link again (2).')
      expect(screen.getByRole('textbox', { name: 'Article link' })).toBe(field)
      expect(field).toHaveFocus()
      expect([field.selectionStart, field.selectionEnd]).toEqual([0, url.length])
      expect(status).not.toHaveTextContent('Article link copied')
    }
  )

  it('clears stale success on failure and counts only successful copies across retries', async () => {
    const user = userEvent.setup()
    const writeText = writeMock()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Later failure'))
      .mockResolvedValue(undefined)
    installClipboard({ writeText })
    render(<CopyArticleLink url={url} />)
    const button = screen.getByRole('button', { name: buttonName })
    await user.click(button)
    expect(screen.getByRole('status')).toHaveTextContent(/^Article link copied\.$/)
    await user.click(button)
    expect(screen.getByRole('status')).not.toHaveTextContent('Article link copied')
    expect(screen.getByRole('textbox', { name: 'Article link' })).toHaveFocus()
    await user.tab({ shift: true })
    await user.keyboard('{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent(/^Article link copied again \(2\)\.$/)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
    expect(writeText).toHaveBeenCalledTimes(3)
  })
})
