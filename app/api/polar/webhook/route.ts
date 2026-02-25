import { NextResponse } from 'next/server'
import {
  PolarConfigError,
  PolarErrorCodes,
  normalizeInterval,
  requirePolarWebhookSecret,
  stringifyError,
  toIsoDate,
  verifyPolarSignature,
  getPayloadClient,
} from 'lib/polar/server'

export const runtime = 'nodejs'

type RecordShape = Record<string, unknown>
type PayloadClient = Awaited<ReturnType<typeof getPayloadClient>>

function asRecord(value: unknown): RecordShape | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as RecordShape
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false
  }
  return undefined
}

function firstString(record: RecordShape | null, keys: string[]): string | undefined {
  if (!record) return undefined
  for (const key of keys) {
    const value = asString(record[key])
    if (value) return value
  }
  return undefined
}

function toDocId(value: unknown): string | number | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return undefined
}

function extractEvent(raw: unknown) {
  const eventRecord = asRecord(raw)
  if (!eventRecord) return null

  const eventType = firstString(eventRecord, ['type', 'event'])
  const eventId =
    firstString(eventRecord, ['id', 'webhook_id', 'webhookId', 'event_id', 'eventId']) ||
    `${eventType || 'unknown'}:${Date.now()}`
  const payloadData = asRecord(eventRecord.data) || eventRecord

  return {
    eventType,
    eventId,
    payloadData,
    raw: eventRecord,
  }
}

async function findOneByField(
  payloadClient: PayloadClient,
  collection: string,
  field: string,
  value: unknown
) {
  const result = await payloadClient.find({
    collection,
    where: {
      [field]: {
        equals: value,
      },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs?.[0] || null
}

async function resolveUserId(
  payloadClient: PayloadClient,
  customerData: RecordShape | null,
  payloadData: RecordShape
) {
  const metadata = asRecord(customerData?.metadata) || asRecord(payloadData.metadata)
  const externalId =
    firstString(customerData, ['external_id', 'externalId', 'user_id', 'userId']) ||
    firstString(metadata, ['userId', 'user_id'])

  if (!externalId) return undefined
  const maybeNumeric = /^\d+$/.test(externalId) ? Number(externalId) : externalId

  try {
    const user = await payloadClient.findByID({
      collection: 'users',
      id: maybeNumeric,
      overrideAccess: true,
      depth: 0,
    })
    return user.id as string | number
  } catch {
    return undefined
  }
}

async function upsertCustomer(payloadClient: PayloadClient, payloadData: RecordShape) {
  const customerData = asRecord(payloadData.customer) || payloadData
  const polarCustomerId =
    firstString(customerData, ['id', 'customer_id', 'customerId', 'polarCustomerId']) ||
    firstString(payloadData, ['customer_id', 'customerId'])
  const email =
    firstString(customerData, ['email', 'customer_email']) || firstString(payloadData, ['email'])
  const name =
    firstString(customerData, ['name', 'full_name']) || firstString(payloadData, ['name'])

  let existing: RecordShape | null = null
  if (polarCustomerId) {
    existing = await findOneByField(
      payloadClient,
      'polarCustomers',
      'polarCustomerId',
      polarCustomerId
    )
  }
  if (!existing && email) {
    existing = await findOneByField(payloadClient, 'polarCustomers', 'email', email.toLowerCase())
  }

  const userId = await resolveUserId(payloadClient, customerData, payloadData)

  const baseData = {
    ...(polarCustomerId ? { polarCustomerId } : {}),
    ...(email ? { email: email.toLowerCase() } : {}),
    ...(name ? { name } : {}),
    ...(userId !== undefined ? { user: userId } : {}),
    metadata: {
      ...(asRecord(existing?.metadata) || {}),
      ...(asRecord(customerData?.metadata) || {}),
      webhookType: firstString(payloadData, ['type']) || undefined,
    },
  }

  const existingCustomerId = toDocId(existing?.id)
  if (existingCustomerId !== undefined) {
    return await payloadClient.update({
      collection: 'polarCustomers',
      id: existingCustomerId,
      data: baseData,
      overrideAccess: true,
      depth: 0,
    })
  }

  if (!polarCustomerId || !email) return null

  return await payloadClient.create({
    collection: 'polarCustomers',
    data: baseData,
    overrideAccess: true,
    depth: 0,
  })
}

async function upsertSubscription(
  payloadClient: PayloadClient,
  payloadData: RecordShape,
  customerDoc: RecordShape | null
) {
  const nestedSubscription = asRecord(payloadData.subscription)
  const source = nestedSubscription || payloadData
  const subscriptionId = nestedSubscription
    ? firstString(source, ['id', 'subscription_id', 'subscriptionId', 'polarSubscriptionId'])
    : firstString(source, ['subscription_id', 'subscriptionId', 'polarSubscriptionId'])
  if (!subscriptionId) return null

  let existing: RecordShape | null = await findOneByField(
    payloadClient,
    'polarSubscriptions',
    'polarSubscriptionId',
    subscriptionId
  )

  let customerId = customerDoc?.id as string | number | undefined
  if (!customerId) {
    const customerLookupId =
      firstString(source, ['customer_id', 'customerId']) ||
      firstString(asRecord(source.customer), ['id', 'customer_id', 'customerId'])
    if (customerLookupId) {
      const customerLookup = await findOneByField(
        payloadClient,
        'polarCustomers',
        'polarCustomerId',
        customerLookupId
      )
      customerId = customerLookup?.id as string | number | undefined
    }
  }

  if (!customerId && existing?.customer) {
    customerId = existing.customer as string | number
  }

  if (!customerId) {
    throw new Error('Missing customer linkage for Polar subscription event.')
  }

  const interval = normalizeInterval(
    source.recurring_interval || source.interval || source.billing_interval
  )
  const status = firstString(source, ['status', 'subscription_status']) || 'active'
  const productId =
    firstString(source, ['product_id', 'productId', 'price_id', 'priceId']) || 'unknown-product'
  const currentPeriodStart = toIsoDate(
    firstString(source, ['current_period_start', 'currentPeriodStart'])
  )
  const currentPeriodEnd = toIsoDate(
    firstString(source, ['current_period_end', 'currentPeriodEnd'])
  )
  const canceledAt = toIsoDate(firstString(source, ['canceled_at', 'canceledAt']))
  const cancelAtPeriodEnd = asBoolean(
    source.cancel_at_period_end ?? source.cancelAtPeriodEnd ?? false
  )

  const updateData = {
    polarSubscriptionId: subscriptionId,
    customer: customerId,
    user: (customerDoc?.user || existing?.user) as string | number | undefined,
    productId,
    interval,
    status,
    ...(currentPeriodStart ? { currentPeriodStart } : {}),
    ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
    ...(canceledAt ? { canceledAt } : {}),
    ...(cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd } : {}),
    metadata: {
      ...(asRecord(existing?.metadata) || {}),
      ...(asRecord(source.metadata) || {}),
    },
  }

  const existingSubscriptionId = toDocId(existing?.id)
  if (existingSubscriptionId !== undefined) {
    return await payloadClient.update({
      collection: 'polarSubscriptions',
      id: existingSubscriptionId,
      data: updateData,
      overrideAccess: true,
      depth: 0,
    })
  }

  existing = await findOneByField(
    payloadClient,
    'polarSubscriptions',
    'polarSubscriptionId',
    subscriptionId
  )
  const duplicatedSubscriptionId = toDocId(existing?.id)
  if (duplicatedSubscriptionId !== undefined) {
    return await payloadClient.update({
      collection: 'polarSubscriptions',
      id: duplicatedSubscriptionId,
      data: updateData,
      overrideAccess: true,
      depth: 0,
    })
  }

  return await payloadClient.create({
    collection: 'polarSubscriptions',
    data: updateData,
    overrideAccess: true,
    depth: 0,
  })
}

function shouldUpsertSubscription(eventType: string, payloadData: RecordShape) {
  const normalizedEventType = eventType.toLowerCase()
  if (normalizedEventType.includes('subscription')) return true

  if (asRecord(payloadData.subscription)) return true

  const explicitSubscriptionId = firstString(payloadData, [
    'subscription_id',
    'subscriptionId',
    'polarSubscriptionId',
  ])

  return Boolean(explicitSubscriptionId)
}

function jsonError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
      details,
    },
    { status }
  )
}

export async function POST(request: Request) {
  let payloadClient: PayloadClient | null = null
  let webhookDocId: string | number | undefined

  try {
    const secret = requirePolarWebhookSecret()
    const signatureHeader =
      request.headers.get('polar-signature') ||
      request.headers.get('x-polar-signature') ||
      request.headers.get('webhook-signature')

    if (!signatureHeader) {
      return jsonError(
        401,
        PolarErrorCodes.InvalidSignature,
        'Missing Polar webhook signature header.'
      )
    }

    const rawBody = await request.text()
    const validSignature = verifyPolarSignature(rawBody, signatureHeader, secret)
    if (!validSignature) {
      return jsonError(401, PolarErrorCodes.InvalidSignature, 'Invalid Polar webhook signature.')
    }

    let parsedPayload: unknown
    try {
      parsedPayload = JSON.parse(rawBody)
    } catch {
      return jsonError(400, PolarErrorCodes.InvalidPayload, 'Webhook payload is not valid JSON.')
    }

    const extractedEvent = extractEvent(parsedPayload)
    if (!extractedEvent || !extractedEvent.eventType) {
      return jsonError(
        400,
        PolarErrorCodes.InvalidPayload,
        'Webhook payload is missing event type.'
      )
    }

    payloadClient = await getPayloadClient()
    const existingWebhook = await findOneByField(
      payloadClient,
      'polarWebhookEvents',
      'webhookId',
      extractedEvent.eventId
    )

    if (existingWebhook?.processed) {
      return NextResponse.json(
        {
          ok: true,
          duplicate: true,
          code: 'OK',
        },
        { status: 200 }
      )
    }

    if (existingWebhook?.id) {
      webhookDocId = existingWebhook.id as string | number
    } else {
      const createdWebhook = await payloadClient.create({
        collection: 'polarWebhookEvents',
        data: {
          webhookId: extractedEvent.eventId,
          type: extractedEvent.eventType,
          payload: extractedEvent.raw,
          receivedAt: new Date().toISOString(),
          processed: false,
        },
        depth: 0,
        overrideAccess: true,
      })
      webhookDocId = createdWebhook.id as string | number
    }

    const customer = await upsertCustomer(payloadClient, extractedEvent.payloadData)

    if (shouldUpsertSubscription(extractedEvent.eventType, extractedEvent.payloadData)) {
      await upsertSubscription(
        payloadClient,
        extractedEvent.payloadData,
        customer as RecordShape | null
      )
    }

    if (webhookDocId !== undefined) {
      await payloadClient.update({
        collection: 'polarWebhookEvents',
        id: webhookDocId,
        data: {
          processed: true,
          processedAt: new Date().toISOString(),
          error: null,
        },
        depth: 0,
        overrideAccess: true,
      })
    }

    return NextResponse.json(
      {
        ok: true,
        code: 'OK',
      },
      { status: 200 }
    )
  } catch (error) {
    const errorMessage = stringifyError(error)

    if (payloadClient && webhookDocId !== undefined) {
      try {
        await payloadClient.update({
          collection: 'polarWebhookEvents',
          id: webhookDocId,
          data: {
            processed: false,
            error: errorMessage,
          },
          depth: 0,
          overrideAccess: true,
        })
      } catch (writeError) {
        console.error('[polar webhook] failed to persist error state', writeError)
      }
    }

    if (error instanceof PolarConfigError) {
      console.error('[polar webhook] config error', error.message)
      return jsonError(500, error.code, error.message)
    }

    console.error('[polar webhook] processing error', error)
    return jsonError(500, PolarErrorCodes.ProcessingFailed, 'Failed to process webhook event.')
  }
}
