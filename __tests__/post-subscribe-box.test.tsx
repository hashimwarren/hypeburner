import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewsletterForm from '@/components/NewsletterForm'
import PostSubscribeBox from '@/components/PostSubscribeBox'
import siteMetadata from '@/data/siteMetadata'

const originalFetch = global.fetch
const newsletter = siteMetadata.newsletter
const fetchMock = jest.fn()

function response(ok: boolean, body: { ok: boolean; message?: string }) {
  return { ok, json: async () => body } as Response
}

beforeEach(() => {
  global.fetch = fetchMock
  fetchMock.mockReset()
})

afterEach(() => {
  global.fetch = originalFetch
  siteMetadata.newsletter = newsletter
})

test('renders one compact issue signup with an accessible, visually hidden email label', () => {
  const { container } = render(<PostSubscribeBox />)

  expect(screen.getAllByRole('heading')).toHaveLength(1)
  expect(screen.getByRole('heading', { name: 'Developer Tool News' })).toBeInTheDocument()
  expect(screen.getAllByRole('button')).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Send me the next issue' })).toBeEnabled()
  expect(screen.getByRole('textbox', { name: 'Email address' })).toHaveAttribute(
    'placeholder',
    'you@example.com'
  )
  expect(screen.getByText('Email address')).toHaveClass('sr-only')
  expect(container.querySelectorAll('form')).toHaveLength(1)
  expect(container.querySelector('[data-uidotsh-option]')).not.toBeInTheDocument()
  expect(container).not.toHaveTextContent(
    /Weekly devtools signal|Get the next issue before|In your inbox weekly|Unsubscribe anytime|Free/
  )
})

test('hides the issue signup when the newsletter provider is disabled', () => {
  siteMetadata.newsletter = undefined
  const { container } = render(<PostSubscribeBox />)
  expect(container).toBeEmptyDOMElement()
})

test('preserves the shared form default copy for other signup placements', () => {
  render(<NewsletterForm />)
  expect(screen.getByRole('heading', { name: 'Subscribe to the newsletter' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument()
  expect(screen.getByText('Get new posts and launch breakdowns in your inbox.')).toBeInTheDocument()
})

test('validates invalid email without contacting the signup API', () => {
  render(<PostSubscribeBox />)
  const email = screen.getByRole('textbox', { name: 'Email address' })
  fireEvent.change(email, { target: { value: 'invalid' } })
  fireEvent.submit(email.closest('form')!)
  expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument()
  expect(email).toHaveAttribute('aria-invalid', 'true')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('normalizes the email, disables repeated clicks while pending, and restores the custom CTA', async () => {
  const user = userEvent.setup()
  let resolveRequest!: (value: Response) => void
  fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (resolveRequest = resolve)))
  render(<PostSubscribeBox />)
  const email = screen.getByRole('textbox', { name: 'Email address' })
  await user.type(email, 'Reader@Example.COM')
  await user.click(screen.getByRole('button', { name: 'Send me the next issue' }))

  expect(fetchMock).toHaveBeenCalledWith('/api/newsletter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'reader@example.com' }),
  })
  expect(email).toBeDisabled()
  const pending = screen.getByRole('button', { name: 'Subscribing...' })
  expect(pending).toBeDisabled()
  await user.click(pending)
  expect(fetchMock).toHaveBeenCalledTimes(1)

  await act(async () =>
    resolveRequest(response(true, { ok: true, message: 'You are subscribed.' }))
  )
  expect(screen.getByText('You are subscribed.')).toBeInTheDocument()
  expect(email).toBeEnabled()
  expect(email).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Send me the next issue' })).toBeEnabled()
})

test('shows an API error, preserves the email, and allows a successful retry', async () => {
  const user = userEvent.setup()
  fetchMock
    .mockResolvedValueOnce(response(false, { ok: false, message: 'Please try again later.' }))
    .mockResolvedValueOnce(response(true, { ok: true, message: "You're already subscribed." }))
  render(<PostSubscribeBox />)
  const email = screen.getByRole('textbox', { name: 'Email address' })
  const submit = screen.getByRole('button', { name: 'Send me the next issue' })
  await user.type(email, 'reader@example.com')
  await user.click(submit)
  expect(await screen.findByText('Please try again later.')).toBeInTheDocument()
  expect(email).toHaveValue('reader@example.com')
  expect(submit).toBeEnabled()
  await user.click(submit)
  expect(await screen.findByText("You're already subscribed.")).toBeInTheDocument()
  expect(email).toHaveValue('')
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test.each(['network', 'invalid-json'] as const)('recovers from a %s failure', async (failure) => {
  if (failure === 'network') fetchMock.mockRejectedValueOnce(new Error('offline'))
  else
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error('invalid JSON')
      },
    })
  render(<PostSubscribeBox />)
  const email = screen.getByRole('textbox', { name: 'Email address' })
  fireEvent.change(email, { target: { value: 'reader@example.com' } })
  fireEvent.submit(email.closest('form')!)
  await waitFor(() => {
    expect(
      screen.getByText("We couldn't subscribe you right now. Please try again shortly.")
    ).toBeInTheDocument()
  })
  expect(email).toBeEnabled()
  expect(email).toHaveValue('reader@example.com')
  expect(screen.getByRole('button', { name: 'Send me the next issue' })).toBeEnabled()
})
