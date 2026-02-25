type NewsletterRouteModule = {
  POST: (request: Request) => Promise<Response>
}

type LoadRouteOptions = {
  envOverrides?: Partial<{
    RESEND_API_KEY: string
  }>
  fetchStatus?: number
  fetchJsonBody?: unknown
  fetchReject?: Error
}

async function loadRoute(options: LoadRouteOptions = {}) {
  const fetchMock = jest.fn()

  if (options.fetchReject) {
    fetchMock.mockRejectedValue(options.fetchReject)
  } else {
    const status = options.fetchStatus ?? 200
    fetchMock.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(options.fetchJsonBody ?? { id: 'contact_123' }),
    })
  }

  ;(global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

  jest.resetModules()

  jest.doMock('lib/env', () => ({
    env: {
      RESEND_API_KEY: 're_test',
      ...options.envOverrides,
    },
  }))

  const route = (await import('../../app/api/newsletter/route')) as NewsletterRouteModule
  return {
    POST: route.POST,
    fetchMock,
  }
}

describe('Newsletter API (/api/newsletter)', () => {
  it('returns 400 for empty body', async () => {
    const { POST } = await loadRoute()
    const response = await POST(new Request('http://localhost/api/newsletter', { method: 'POST' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(body.code).toBe('ERR_INVALID_EMAIL')
  })

  it('returns 400 for invalid email', async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      new Request('http://localhost/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(body.code).toBe('ERR_INVALID_EMAIL')
  })

  it('returns 500 when required Resend config is missing', async () => {
    const { POST } = await loadRoute({
      envOverrides: {
        RESEND_API_KEY: '',
      },
    })
    const response = await POST(
      new Request('http://localhost/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reader@example.com' }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.code).toBe('ERR_MISSING_ENV_VARS')
  })

  it('returns 200 for successful subscriptions', async () => {
    const { POST, fetchMock } = await loadRoute()
    const response = await POST(
      new Request('http://localhost/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'Reader@Example.com' }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.code).toBe('OK')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/contacts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test',
          'Content-Type': 'application/json',
        }),
      })
    )
    const [, callInit] = fetchMock.mock.calls[0]
    expect(JSON.parse(callInit.body as string)).toEqual({
      email: 'reader@example.com',
      unsubscribed: false,
    })
  })

  it('treats existing contacts as successful idempotent subscriptions', async () => {
    const { POST } = await loadRoute({
      fetchStatus: 409,
      fetchJsonBody: {
        message: 'Contact already exists',
      },
    })
    const response = await POST(
      new Request('http://localhost/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reader@example.com' }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.code).toBe('OK_ALREADY_SUBSCRIBED')
  })

  it('returns 502 when Resend contacts API fails', async () => {
    const { POST } = await loadRoute({
      fetchStatus: 500,
      fetchJsonBody: {
        message: 'Resend is unavailable',
      },
    })
    const response = await POST(
      new Request('http://localhost/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reader@example.com' }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.ok).toBe(false)
    expect(body.code).toBe('ERR_NEWSLETTER_UPSTREAM')
  })
})
