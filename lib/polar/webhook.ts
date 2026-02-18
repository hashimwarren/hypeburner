import crypto from 'crypto'

const WEBHOOK_ID_HEADER = 'webhook-id'
const WEBHOOK_TIMESTAMP_HEADER = 'webhook-timestamp'
const WEBHOOK_SIGNATURE_HEADER = 'webhook-signature'

export class PolarWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PolarWebhookVerificationError'
  }
}

export type PolarWebhookEvent = {
  id?: string
  type: string
  data?: unknown
  [key: string]: unknown
}

type VerifiedWebhook = {
  event: PolarWebhookEvent
  webhookId: string
  webhookTimestamp: string
}

function decodeWebhookSecret(secret: string): Buffer {
  if (secret.startsWith('whsec_')) {
    const encoded = secret.slice('whsec_'.length)
    return Buffer.from(encoded, 'base64')
  }

  return Buffer.from(secret, 'utf8')
}

function parseSignatureHeader(value: string): Array<{ version: string; signature: string }> {
  return value
    .split(' ')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const commaIndex = entry.indexOf(',')
      if (commaIndex <= 0 || commaIndex === entry.length - 1) {
        return null
      }

      return {
        version: entry.slice(0, commaIndex),
        signature: entry.slice(commaIndex + 1),
      }
    })
    .filter((entry): entry is { version: string; signature: string } => entry !== null)
}

function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)

  if (left.length !== right.length) {
    return false
  }

  return crypto.timingSafeEqual(left, right)
}

function assertRecentTimestamp(timestamp: string, maxAgeSeconds: number): void {
  const parsed = Number(timestamp)
  if (!Number.isFinite(parsed)) {
    throw new PolarWebhookVerificationError('Invalid webhook timestamp')
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const age = Math.abs(nowSeconds - parsed)
  if (age > maxAgeSeconds) {
    throw new PolarWebhookVerificationError('Webhook timestamp is outside the allowed tolerance')
  }
}

function parseEvent(payload: string): PolarWebhookEvent {
  let event: unknown
  try {
    event = JSON.parse(payload)
  } catch {
    throw new PolarWebhookVerificationError('Webhook payload is not valid JSON')
  }

  if (!event || typeof event !== 'object' || typeof (event as { type?: unknown }).type !== 'string') {
    throw new PolarWebhookVerificationError('Webhook payload is missing event type')
  }

  return event as PolarWebhookEvent
}

export function verifyAndParsePolarWebhook(
  payload: string,
  headers: Headers,
  webhookSecret: string,
  maxAgeSeconds = 300
): VerifiedWebhook {
  const webhookId = headers.get(WEBHOOK_ID_HEADER)
  const webhookTimestamp = headers.get(WEBHOOK_TIMESTAMP_HEADER)
  const webhookSignature = headers.get(WEBHOOK_SIGNATURE_HEADER)

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    throw new PolarWebhookVerificationError('Missing required webhook signature headers')
  }

  assertRecentTimestamp(webhookTimestamp, maxAgeSeconds)

  const signedContent = `${webhookId}.${webhookTimestamp}.${payload}`
  const expectedSignature = crypto
    .createHmac('sha256', decodeWebhookSecret(webhookSecret))
    .update(signedContent)
    .digest('base64')

  const valid = parseSignatureHeader(webhookSignature)
    .filter((entry) => entry.version === 'v1')
    .some((entry) => timingSafeEqualString(expectedSignature, entry.signature))

  if (!valid) {
    throw new PolarWebhookVerificationError('Invalid webhook signature')
  }

  return {
    event: parseEvent(payload),
    webhookId,
    webhookTimestamp,
  }
}

