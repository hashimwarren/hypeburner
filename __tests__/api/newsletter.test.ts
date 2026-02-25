type NewsletterRouteModule = {
  POST: (request: Request) => Promise<Response>
}

type LoadRouteOptions = {
  envOverrides?: Partial<{
    RESEND_API_KEY: string
  }>
  createResponse?: {
    data: unknown
    error: { message?: string; name?: string } | null
  }
}

async function loadRoute(options: LoadRouteOptions = {}) {
  const contactsCreate = jest.fn().mockResolvedValue(
    options.createResponse ?? {
      data: { id: 'contact_123' },
      error: null,
    }
  )

  jest.resetModules()
  jest.doMock('resend', () => ({
    Resend: jest.fn().mockImplementation(() => ({
      contacts: {
        create: contactsCreate,
      },
    })),
  }))

  jest.doMock('lib/env', () => ({
    env: {
      RESEND_API_KEY: 're_test',
      ...options.envOverrides,
    },
  }))

  const route = (await import('../../app/api/newsletter/route')) as NewsletterRouteModule
  return {
    POST: route.POST,
    contactsCreate,
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
    const { POST, contactsCreate } = await loadRoute()
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
    expect(contactsCreate).toHaveBeenCalledWith({
      email: 'reader@example.com',
      unsubscribed: false,
    })
  })

  it('treats existing contacts as successful idempotent subscriptions', async () => {
    const { POST } = await loadRoute({
      createResponse: {
        data: null,
        error: {
          name: 'validation_error',
          message: 'Contact already exists',
        },
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
      createResponse: {
        data: null,
        error: {
          name: 'internal_server_error',
          message: 'Resend is unavailable',
        },
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
