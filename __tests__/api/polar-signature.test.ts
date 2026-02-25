import { createHmac } from 'node:crypto'

jest.mock('payload', () => ({
  getPayload: jest.fn(),
}))

jest.mock('../../payload.config', () => ({
  __esModule: true,
  default: Promise.resolve({}),
}))

import { verifyPolarSignature } from 'lib/polar/server'

describe('verifyPolarSignature', () => {
  it('accepts padded base64 signatures in v1 header values', () => {
    const secret = 'whsec_test_secret'
    const rawBody = JSON.stringify({
      id: 'evt_123',
      type: 'subscription.created',
      data: { subscription_id: 'sub_123' },
    })

    const base64Signature = createHmac('sha256', secret).update(rawBody).digest('base64')
    const signatureHeader = `v1=${base64Signature}`

    expect(base64Signature.endsWith('=')).toBe(true)
    expect(verifyPolarSignature(rawBody, signatureHeader, secret)).toBe(true)
  })
})
