import { getPolarAccessToken } from './config'

const POLAR_API_BASE_URL = process.env.POLAR_API_BASE_URL?.trim() || 'https://api.polar.sh'

export class PolarApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'PolarApiError'
    this.status = status
    this.details = details
  }
}

type PolarRequestOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
}

async function polarRequest<T>(path: string, options: PolarRequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options

  const response = await fetch(`${POLAR_API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getPolarAccessToken()}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  const payload = text ? safeJsonParse(text) : null

  if (!response.ok) {
    throw new PolarApiError(
      `Polar API request failed with status ${response.status}`,
      response.status,
      payload ?? text
    )
  }

  return payload as T
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

type PolarMetadataValue = string | number | boolean

export type CreateCheckoutRequest = {
  products: string[]
  success_url: string
  return_url?: string
  customer_id?: string
  external_customer_id?: string
  metadata?: Record<string, PolarMetadataValue>
}

export type PolarCheckout = {
  id?: string
  url?: string
  [key: string]: unknown
}

export async function createCheckoutSession(body: CreateCheckoutRequest): Promise<PolarCheckout> {
  return polarRequest<PolarCheckout>('/v1/checkouts/', { method: 'POST', body })
}

export type CreateCustomerPortalSessionRequest = {
  customer_id?: string
  external_customer_id?: string
  return_url?: string
}

export type PolarCustomerPortalSession = {
  customer_portal_url?: string
  [key: string]: unknown
}

export async function createCustomerPortalSession(
  body: CreateCustomerPortalSessionRequest
): Promise<PolarCustomerPortalSession> {
  return polarRequest<PolarCustomerPortalSession>('/v1/customer-sessions/', {
    method: 'POST',
    body,
  })
}

