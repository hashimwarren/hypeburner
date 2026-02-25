type PolarServerMock = {
  PolarConfigError: typeof Error
  PolarUpstreamError: new (message: string, status: number, payload: unknown) => Error
  PolarErrorCodes: Record<string, string>
  getPayloadClient: jest.Mock
  resolveProductId: jest.Mock
  callPolarApi: jest.Mock
  extractPolarUrl: jest.Mock
  requirePolarWebhookSecret: jest.Mock
  verifyPolarSignature: jest.Mock
  normalizeInterval: jest.Mock
  stringifyError: jest.Mock
  toIsoDate: jest.Mock
}

function createPolarServerMock(overrides: Partial<PolarServerMock> = {}): PolarServerMock {
  class MockPolarConfigError extends Error {
    code: string

    constructor(message: string) {
      super(message)
      this.name = 'PolarConfigError'
      this.code = 'ERR_POLAR_MISSING_CONFIG'
    }
  }

  class MockPolarUpstreamError extends Error {
    status: number
    payload: unknown
    code: string

    constructor(message: string, status: number, payload: unknown) {
      super(message)
      this.name = 'PolarUpstreamError'
      this.status = status
      this.payload = payload
      this.code = 'ERR_POLAR_UPSTREAM'
    }
  }

  return {
    PolarConfigError: MockPolarConfigError,
    PolarUpstreamError: MockPolarUpstreamError,
    PolarErrorCodes: {
      InvalidInput: 'ERR_POLAR_INVALID_INPUT',
      Unauthorized: 'ERR_POLAR_UNAUTHORIZED',
      MissingConfig: 'ERR_POLAR_MISSING_CONFIG',
      Upstream: 'ERR_POLAR_UPSTREAM',
      CustomerNotFound: 'ERR_POLAR_CUSTOMER_NOT_FOUND',
      InvalidSignature: 'ERR_POLAR_INVALID_SIGNATURE',
      InvalidPayload: 'ERR_POLAR_INVALID_PAYLOAD',
      ProcessingFailed: 'ERR_POLAR_PROCESSING_FAILED',
    },
    getPayloadClient: jest.fn(),
    resolveProductId: jest.fn(() => 'prod_monthly'),
    callPolarApi: jest.fn(),
    extractPolarUrl: jest.fn((value: unknown) => (value as { url?: string })?.url || null),
    requirePolarWebhookSecret: jest.fn(() => 'whsec_test'),
    verifyPolarSignature: jest.fn(() => true),
    normalizeInterval: jest.fn(() => 'monthly'),
    stringifyError: jest.fn((err: unknown) => (err instanceof Error ? err.message : String(err))),
    toIsoDate: jest.fn(() => '2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

async function loadRoute(
  routePath: string,
  serverOverrides: Partial<PolarServerMock> = {}
): Promise<{ POST: (request: Request) => Promise<Response>; serverMock: PolarServerMock }> {
  jest.resetModules()
  const serverMock = createPolarServerMock(serverOverrides)

  jest.doMock('lib/polar/server', () => serverMock)
  jest.doMock('lib/env', () => ({
    env: {
      NEXT_PUBLIC_SITE_URL: 'https://hypeburner.com',
    },
  }))

  const route = await import(routePath)
  return {
    POST: route.POST as (request: Request) => Promise<Response>,
    serverMock,
  }
}

describe('Polar checkout API', () => {
  it('returns 400 for invalid checkout payload', async () => {
    const { POST } = await loadRoute('../../app/api/polar/checkout/route')

    const response = await POST(
      new Request('http://localhost/api/polar/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ interval: 'monthly' }),
      })
    )

    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('ERR_POLAR_INVALID_INPUT')
  })

  it('returns checkout URL for valid payload', async () => {
    const payloadClient = {
      findByID: jest.fn().mockResolvedValue({
        id: 'user_1',
        email: 'member@example.com',
        name: 'Member One',
      }),
      find: jest.fn().mockResolvedValue({
        docs: [{ polarCustomerId: 'cus_123' }],
      }),
    }

    const { POST, serverMock } = await loadRoute('../../app/api/polar/checkout/route', {
      getPayloadClient: jest.fn().mockResolvedValue(payloadClient),
      resolveProductId: jest.fn(() => 'prod_123'),
      callPolarApi: jest.fn().mockResolvedValue({ url: 'https://polar.sh/checkout/session_1' }),
      extractPolarUrl: jest.fn(() => 'https://polar.sh/checkout/session_1'),
    })

    const response = await POST(
      new Request('http://localhost/api/polar/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          interval: 'monthly',
          email: 'alt@example.com',
          userId: '1',
        }),
      })
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.url).toBe('https://polar.sh/checkout/session_1')
    expect(serverMock.callPolarApi).toHaveBeenCalledWith(
      '/v1/checkouts',
      expect.objectContaining({
        product_id: 'prod_123',
        customer_email: 'member@example.com',
        customer_id: 'cus_123',
      })
    )
  })

  it('returns 502 when Polar upstream fails', async () => {
    const payloadClient = {
      findByID: jest.fn(),
      find: jest.fn().mockResolvedValue({ docs: [] }),
    }

    const { POST, serverMock } = await loadRoute('../../app/api/polar/checkout/route', {
      getPayloadClient: jest.fn().mockResolvedValue(payloadClient),
    })

    serverMock.callPolarApi.mockRejectedValue(
      new serverMock.PolarUpstreamError('upstream failure', 500, { message: 'bad gateway' })
    )

    const response = await POST(
      new Request('http://localhost/api/polar/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          interval: 'monthly',
          email: 'member@example.com',
        }),
      })
    )

    const body = await response.json()
    expect(response.status).toBe(502)
    expect(body.code).toBe('ERR_POLAR_UPSTREAM')
  })
})

describe('Polar portal API', () => {
  it('returns 401 when request is unauthenticated', async () => {
    const payloadClient = {
      auth: jest.fn().mockResolvedValue({ user: null }),
      find: jest.fn(),
    }

    const { POST } = await loadRoute('../../app/api/polar/portal/route', {
      getPayloadClient: jest.fn().mockResolvedValue(payloadClient),
    })

    const response = await POST(
      new Request('http://localhost/api/polar/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    )

    const body = await response.json()
    expect(response.status).toBe(401)
    expect(body.code).toBe('ERR_POLAR_UNAUTHORIZED')
  })

  it('returns 404 when authenticated user has no customer record', async () => {
    const payloadClient = {
      auth: jest.fn().mockResolvedValue({ user: { id: 'user_1', role: 'customer' } }),
      find: jest.fn().mockResolvedValue({ docs: [] }),
    }

    const { POST } = await loadRoute('../../app/api/polar/portal/route', {
      getPayloadClient: jest.fn().mockResolvedValue(payloadClient),
    })

    const response = await POST(
      new Request('http://localhost/api/polar/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    )

    const body = await response.json()
    expect(response.status).toBe(404)
    expect(body.code).toBe('ERR_POLAR_CUSTOMER_NOT_FOUND')
  })

  it('falls back to second endpoint and returns a portal URL', async () => {
    const payloadClient = {
      auth: jest.fn().mockResolvedValue({ user: { id: 'user_1', role: 'customer' } }),
      find: jest.fn().mockResolvedValue({
        docs: [{ polarCustomerId: 'cus_999' }],
      }),
    }

    const { POST, serverMock } = await loadRoute('../../app/api/polar/portal/route', {
      getPayloadClient: jest.fn().mockResolvedValue(payloadClient),
      extractPolarUrl: jest.fn(() => 'https://polar.sh/portal/session_1'),
    })

    serverMock.callPolarApi
      .mockRejectedValueOnce(new serverMock.PolarUpstreamError('not found', 404, {}))
      .mockResolvedValueOnce({ url: 'https://polar.sh/portal/session_1' })

    const response = await POST(
      new Request('http://localhost/api/polar/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.url).toBe('https://polar.sh/portal/session_1')
    expect(serverMock.callPolarApi).toHaveBeenNthCalledWith(1, '/v1/customer-sessions', {
      customer_id: 'cus_999',
    })
    expect(serverMock.callPolarApi).toHaveBeenNthCalledWith(2, '/v1/customer-portal/sessions', {
      customer_id: 'cus_999',
    })
  })
})

describe('Polar webhook API', () => {
  it('rejects requests without signature header', async () => {
    const { POST, serverMock } = await loadRoute('../../app/api/polar/webhook/route')

    const response = await POST(
      new Request('http://localhost/api/polar/webhook', {
        method: 'POST',
        body: JSON.stringify({ type: 'subscription.created' }),
      })
    )

    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.code).toBe('ERR_POLAR_INVALID_SIGNATURE')
    expect(serverMock.getPayloadClient).not.toHaveBeenCalled()
  })

  it('returns duplicate=true for already processed events', async () => {
    const payloadClient = {
      find: jest.fn().mockResolvedValue({
        docs: [{ id: 'wh_1', processed: true }],
      }),
      create: jest.fn(),
      update: jest.fn(),
      findByID: jest.fn(),
    }

    const { POST } = await loadRoute('../../app/api/polar/webhook/route', {
      getPayloadClient: jest.fn().mockResolvedValue(payloadClient),
      verifyPolarSignature: jest.fn(() => true),
    })

    const response = await POST(
      new Request('http://localhost/api/polar/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'polar-signature': 'sig_123',
        },
        body: JSON.stringify({
          id: 'evt_123',
          type: 'subscription.created',
          data: {},
        }),
      })
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.duplicate).toBe(true)
    expect(payloadClient.create).not.toHaveBeenCalled()
    expect(payloadClient.update).not.toHaveBeenCalled()
  })

  it('does not upsert subscriptions for non-subscription events', async () => {
    const payloadClient = {
      find: jest.fn().mockImplementation(({ collection }) => {
        if (collection === 'polarWebhookEvents') {
          return Promise.resolve({ docs: [] })
        }
        if (collection === 'polarCustomers') {
          return Promise.resolve({ docs: [] })
        }
        if (collection === 'polarSubscriptions') {
          return Promise.resolve({ docs: [] })
        }
        return Promise.resolve({ docs: [] })
      }),
      create: jest.fn().mockImplementation(({ collection }) => {
        if (collection === 'polarWebhookEvents') {
          return Promise.resolve({ id: 'wh_new' })
        }
        if (collection === 'polarCustomers') {
          return Promise.resolve({ id: 'cust_1', user: 'user_1' })
        }
        return Promise.resolve({ id: 'doc_1' })
      }),
      update: jest.fn().mockResolvedValue({}),
      findByID: jest.fn().mockResolvedValue({ id: 'user_1' }),
    }

    const { POST } = await loadRoute('../../app/api/polar/webhook/route', {
      getPayloadClient: jest.fn().mockResolvedValue(payloadClient),
      verifyPolarSignature: jest.fn(() => true),
    })

    const response = await POST(
      new Request('http://localhost/api/polar/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'polar-signature': 'sig_123',
        },
        body: JSON.stringify({
          id: 'evt_customer_1',
          type: 'customer.updated',
          data: {
            customer: {
              id: 'cus_1',
              email: 'member@example.com',
              metadata: { userId: 'user_1' },
            },
          },
        }),
      })
    )

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(payloadClient.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'polarSubscriptions' })
    )
    expect(payloadClient.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'polarSubscriptions' })
    )
  })

  it('returns 400 for invalid JSON payloads', async () => {
    const { POST } = await loadRoute('../../app/api/polar/webhook/route', {
      verifyPolarSignature: jest.fn(() => true),
    })

    const response = await POST(
      new Request('http://localhost/api/polar/webhook', {
        method: 'POST',
        headers: {
          'polar-signature': 'sig_123',
        },
        body: '{not-json',
      })
    )

    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('ERR_POLAR_INVALID_PAYLOAD')
  })
})
