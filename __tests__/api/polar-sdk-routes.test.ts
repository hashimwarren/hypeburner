/** @jest-environment node */

import { createHmac, randomBytes, randomUUID } from 'node:crypto'

class PolarConfigurationError extends Error {}

const createCheckout = jest.fn()
const getPolar = jest.fn()
const getPolarWebhookSecret = jest.fn()

let GET: (request: Request) => Promise<Response>
let POST: (request: Request) => Promise<Response>
let signingSecret: string

beforeAll(async () => {
  jest.doMock('lib/polar/client', () => ({
    PolarConfigurationError,
    getPolar,
    getPolarWebhookSecret,
  }))

  GET = (await import('../../app/checkout/route')).GET
  POST = (await import('../../app/api/webhook/polar/route')).POST
})

beforeEach(() => {
  signingSecret = randomBytes(32).toString('base64')
  createCheckout.mockReset()
  getPolar.mockReset().mockReturnValue({ checkouts: { create: createCheckout } })
  getPolarWebhookSecret.mockReset().mockReturnValue(signingSecret)
})

function customerFixture() {
  return {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    modified_at: null,
    metadata: {},
    email: 'customer@example.test',
    email_verified: true,
    type: 'individual',
    name: null,
    billing_name: null,
    billing_address: null,
    tax_id: null,
    organization_id: randomUUID(),
    deleted_at: null,
    avatar_url: null,
  }
}

function customerStateEvent() {
  return {
    type: 'customer.state_changed',
    timestamp: new Date().toISOString(),
    data: {
      ...customerFixture(),
      active_subscriptions: [],
      granted_benefits: [],
      active_meters: [],
    },
  }
}

function orderPaidEvent() {
  const customer = customerFixture()
  return {
    type: 'order.paid',
    timestamp: new Date().toISOString(),
    data: {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      modified_at: null,
      status: 'paid',
      paid: true,
      subtotal_amount: 1000,
      discount_amount: 0,
      net_amount: 1000,
      tax_amount: 0,
      total_amount: 1000,
      applied_balance_amount: 0,
      due_amount: 0,
      refunded_amount: 0,
      refunded_tax_amount: 0,
      currency: 'usd',
      billing_reason: 'purchase',
      billing_name: null,
      billing_address: null,
      invoice_number: null,
      is_invoice_generated: false,
      receipt_number: null,
      customer_id: customer.id,
      product_id: null,
      discount_id: null,
      subscription_id: null,
      checkout_id: null,
      metadata: {},
      platform_fee_amount: 0,
      platform_fee_currency: null,
      customer,
      product: null,
      discount: null,
      subscription: null,
      items: [],
      description: 'Test purchase',
      refundable_amount: 1000,
      refundable_tax_amount: 0,
    },
  }
}

// Sign independently of the SDK; route tests exercise its real verification and schemas.
function signedHeaders(
  body: string,
  timestamp = Math.floor(Date.now() / 1000)
): Record<string, string> {
  const id = randomUUID()
  const signature = createHmac('sha256', signingSecret)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64')

  return {
    'content-type': 'application/json',
    'webhook-id': id,
    'webhook-timestamp': String(timestamp),
    'webhook-signature': `v1,${signature}`,
  }
}

function webhookRequest(body: string, headers = signedHeaders(body)) {
  return new Request('http://localhost/api/webhook/polar', {
    method: 'POST',
    headers,
    body,
  })
}

describe('SDK checkout redirect', () => {
  it.each(['', '?products=', '?products=not-a-uuid'])(
    'rejects missing or invalid products before calling Polar (%s)',
    async (query) => {
      const response = await GET(new Request(`http://localhost/checkout${query}`))

      expect(response.status).toBe(400)
      expect(createCheckout).not.toHaveBeenCalled()
    }
  )

  it('redirects to the SDK checkout URL without accepting client confirmation overrides', async () => {
    const products = [randomUUID(), randomUUID()]
    const url = `https://checkout.example.test/${randomUUID()}`
    createCheckout.mockResolvedValue({ url })
    const query = new URLSearchParams()
    products.forEach((id) => query.append('products', id))
    query.set('successUrl', 'https://client.example.test/confirmation')
    query.set('success_url', 'https://client.example.test/confirmation')

    const response = await GET(new Request(`http://localhost/checkout?${query}`))

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(url)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(createCheckout).toHaveBeenCalledTimes(1)
    expect(createCheckout).toHaveBeenCalledWith({ products })
  })

  it('returns a generic upstream failure without exposing private error details', async () => {
    const privateDetail = `private-upstream-detail-${randomUUID()}`
    createCheckout.mockRejectedValue(new Error(privateDetail))
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const response = await GET(new Request(`http://localhost/checkout?products=${randomUUID()}`))

      expect(response.status).toBe(502)
      expect(await response.text()).not.toContain(privateDetail)
      expect(errorLog.mock.calls.flat().map(String).join(' ')).not.toContain(privateDetail)
    } finally {
      errorLog.mockRestore()
    }
  })

  it('returns service unavailable when checkout configuration is missing', async () => {
    getPolar.mockImplementation(() => {
      throw new PolarConfigurationError('Missing POLAR_ACCESS_TOKEN')
    })

    const response = await GET(new Request(`http://localhost/checkout?products=${randomUUID()}`))

    expect(response.status).toBe(503)
    expect(createCheckout).not.toHaveBeenCalled()
  })
})

describe('SDK webhook verification', () => {
  it.each([
    ['customer.state_changed', customerStateEvent],
    ['order.paid', orderPaidEvent],
  ] as const)('accepts a valid signed %s event', async (_type, fixture) => {
    const body = JSON.stringify(fixture(), null, 2)
    const response = await POST(webhookRequest(body))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true })
    expect(getPolar).not.toHaveBeenCalled()
  })

  it.each(['webhook-id', 'webhook-timestamp', 'webhook-signature'] as const)(
    'rejects a request missing %s',
    async (header) => {
      const body = JSON.stringify(customerStateEvent())
      const headers = signedHeaders(body)
      delete headers[header]

      expect((await POST(webhookRequest(body, headers))).status).toBe(403)
    }
  )

  it('rejects a body changed after signing', async () => {
    const body = JSON.stringify(customerStateEvent())
    const headers = signedHeaders(body)

    expect((await POST(webhookRequest(`${body}\n`, headers))).status).toBe(403)
  })

  it('rejects a different delivery ID with an otherwise valid signature', async () => {
    const body = JSON.stringify(customerStateEvent())
    const headers = { ...signedHeaders(body), 'webhook-id': randomUUID() }

    expect((await POST(webhookRequest(body, headers))).status).toBe(403)
  })

  it('rejects a signature created with a different signing secret', async () => {
    const body = JSON.stringify(customerStateEvent())
    const request = webhookRequest(body)
    getPolarWebhookSecret.mockReturnValue(randomBytes(32).toString('base64'))

    expect((await POST(request)).status).toBe(403)
  })

  it('rejects an expired replay even when its signature is correct', async () => {
    const body = JSON.stringify(customerStateEvent())
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 600

    expect((await POST(webhookRequest(body, signedHeaders(body, expiredTimestamp)))).status).toBe(
      403
    )
  })

  it.each(['{"type":"customer.state_changed","data":{}}', '{malformed-json'])(
    'rejects a correctly signed malformed event (%s)',
    async (body) => {
      expect((await POST(webhookRequest(body))).status).toBe(400)
    }
  )

  it('returns service unavailable when the signing secret is missing', async () => {
    getPolarWebhookSecret.mockImplementation(() => {
      throw new PolarConfigurationError('Missing POLAR_WEBHOOK_SECRET')
    })

    expect((await POST(webhookRequest(JSON.stringify(customerStateEvent())))).status).toBe(503)
  })
})
