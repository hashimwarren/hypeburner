import { createHmac, timingSafeEqual } from 'node:crypto'
import { getPayload } from 'payload'
import configPromise from '../../payload.config'
import { env } from '../env'

export const PolarErrorCodes = {
  InvalidInput: 'ERR_POLAR_INVALID_INPUT',
  Unauthorized: 'ERR_POLAR_UNAUTHORIZED',
  MissingConfig: 'ERR_POLAR_MISSING_CONFIG',
  Upstream: 'ERR_POLAR_UPSTREAM',
  CustomerNotFound: 'ERR_POLAR_CUSTOMER_NOT_FOUND',
  InvalidSignature: 'ERR_POLAR_INVALID_SIGNATURE',
  InvalidPayload: 'ERR_POLAR_INVALID_PAYLOAD',
  ProcessingFailed: 'ERR_POLAR_PROCESSING_FAILED',
} as const

export class PolarConfigError extends Error {
  code: string

  constructor(message: string) {
    super(message)
    this.name = 'PolarConfigError'
    this.code = PolarErrorCodes.MissingConfig
  }
}

export class PolarUpstreamError extends Error {
  status: number
  payload: unknown
  code: string

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'PolarUpstreamError'
    this.status = status
    this.payload = payload
    this.code = PolarErrorCodes.Upstream
  }
}

let payloadClientPromise: ReturnType<typeof getPayload> | null = null

export async function getPayloadClient() {
  if (!payloadClientPromise) {
    payloadClientPromise = getPayload({ config: configPromise })
  }
  return await payloadClientPromise
}

export function resolveProductId(interval: 'monthly' | 'annual'): string {
  const productId =
    interval === 'annual' ? env.POLAR_PRODUCT_ID_ANNUAL : env.POLAR_PRODUCT_ID_MONTHLY

  if (!productId) {
    throw new PolarConfigError(
      `Missing product mapping for ${interval}. Configure POLAR_PRODUCT_ID_MONTHLY and POLAR_PRODUCT_ID_ANNUAL.`
    )
  }

  return productId
}

export function requirePolarAccessToken(): string {
  const token = env.POLAR_ACCESS_TOKEN
  if (!token) {
    throw new PolarConfigError('Missing POLAR_ACCESS_TOKEN')
  }
  return token
}

export function requirePolarWebhookSecret(): string {
  const secret = env.POLAR_WEBHOOK_SECRET
  if (!secret) {
    throw new PolarConfigError('Missing POLAR_WEBHOOK_SECRET')
  }
  return secret
}

export async function callPolarApi(pathname: string, body: Record<string, unknown>) {
  const accessToken = requirePolarAccessToken()
  const baseUrl = env.POLAR_API_BASE_URL.replace(/\/$/, '')
  const target = `${baseUrl}${pathname}`

  const response = await fetch(target, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const raw = await response.text()
  let parsed: unknown = null
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = raw
    }
  }

  if (!response.ok) {
    throw new PolarUpstreamError(
      `Polar request failed (${response.status}) for ${pathname}`,
      response.status,
      parsed
    )
  }

  return parsed
}

function parseSignatureHeader(value: string) {
  const signatures: string[] = []
  let timestamp = ''

  if (!value.includes('=')) {
    signatures.push(value.trim())
    return { signatures: signatures.filter(Boolean), timestamp }
  }

  for (const part of value.split(',')) {
    const separatorIndex = part.indexOf('=')
    if (separatorIndex === -1) continue

    const rawKey = part.slice(0, separatorIndex)
    const rawValue = part.slice(separatorIndex + 1)
    const key = String(rawKey || '')
      .trim()
      .toLowerCase()
    const parsedValue = String(rawValue || '').trim()
    if (!parsedValue) continue

    if (key === 't' || key === 'timestamp') {
      timestamp = parsedValue
      continue
    }

    if (key === 'v1' || key === 's' || key === 'sig' || key === 'signature') {
      signatures.push(parsedValue)
    }
  }

  return { signatures: signatures.filter(Boolean), timestamp }
}

function secureEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

function createHmacCandidates(secret: string, rawBody: string, timestamp?: string) {
  const payloadVariants = [rawBody]
  if (timestamp) {
    payloadVariants.push(`${timestamp}.${rawBody}`)
  }

  const results = new Set<string>()
  for (const candidate of payloadVariants) {
    const digestHex = createHmac('sha256', secret).update(candidate).digest('hex')
    const digestBase64 = createHmac('sha256', secret).update(candidate).digest('base64')
    results.add(digestHex)
    results.add(digestBase64)
  }

  return Array.from(results)
}

export function verifyPolarSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  const { signatures, timestamp } = parseSignatureHeader(signatureHeader)
  if (signatures.length === 0) return false

  const candidates = createHmacCandidates(secret, rawBody, timestamp)
  return signatures.some((signature) =>
    candidates.some((candidate) => secureEquals(signature, candidate))
  )
}

export function extractPolarUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null

  const asRecord = payload as Record<string, unknown>
  const directCandidates = [
    asRecord.url,
    asRecord.checkout_url,
    asRecord.checkoutUrl,
    asRecord.portal_url,
  ]

  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate
    }
  }

  const nested = asRecord.data
  if (nested && typeof nested === 'object') {
    return extractPolarUrl(nested)
  }

  return null
}

export function normalizeInterval(value: unknown): 'monthly' | 'annual' {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (normalized.includes('year') || normalized.includes('annual')) return 'annual'
  return 'monthly'
}

export function toIsoDate(value: unknown): string | undefined {
  if (!value) return undefined
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

export function stringifyError(error: unknown): string {
  if (error instanceof PolarUpstreamError) {
    return `${error.message} :: ${JSON.stringify(error.payload)}`
  }
  if (error instanceof Error) return error.message
  return String(error)
}
