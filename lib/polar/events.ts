import type { PolarWebhookEvent } from './webhook'
import { getPayloadClient } from '../payload'

const WEBHOOK_COLLECTION = 'polarWebhookEvents'
const CUSTOMER_COLLECTION = 'polarCustomers'
const SUBSCRIPTION_COLLECTION = 'polarSubscriptions'

function toISO(value: unknown) {
  if (!value) return undefined
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

function normalizeInterval(value: unknown): 'monthly' | 'annual' {
  const normalized = String(value || '').toLowerCase()
  if (normalized.includes('year') || normalized.includes('annual')) return 'annual'
  return 'monthly'
}

async function upsertByField(collection: string, field: string, value: string, data: Record<string, unknown>) {
  const payload = await getPayloadClient()
  const existing = await payload.find({
    collection,
    where: { [field]: { equals: value } },
    depth: 0,
    limit: 1,
  })
  const doc = existing?.docs?.[0]

  if (doc?.id) {
    return payload.update({ collection, id: doc.id, data, depth: 0 })
  }

  return payload.create({ collection, data: { [field]: value, ...data }, depth: 0 })
}

export async function isPolarWebhookProcessed(webhookId: string): Promise<boolean> {
  const payload = await getPayloadClient()
  const existing = await payload.find({
    collection: WEBHOOK_COLLECTION,
    where: { webhookId: { equals: webhookId } },
    depth: 0,
    limit: 1,
  })
  return Boolean(existing?.docs?.[0]?.processed)
}

export async function markPolarWebhookProcessed(
  webhookId: string,
  event: PolarWebhookEvent,
  error?: string
): Promise<void> {
  await upsertByField(WEBHOOK_COLLECTION, 'webhookId', webhookId, {
    type: event.type,
    payload: event,
    processed: !error,
    processedAt: !error ? new Date().toISOString() : undefined,
    error: error || undefined,
  })
}

export type PolarEventHandlerResult = {
  handled: boolean
}

export async function handlePolarWebhookEvent(
  event: PolarWebhookEvent
): Promise<PolarEventHandlerResult> {
  switch (event.type) {
    case 'subscription.created':
    case 'subscription.updated':
    case 'subscription.canceled':
    case 'subscription.revoked':
      await handleSubscriptionEvent(event)
      return { handled: true }
    case 'order.created':
    case 'order.paid':
      await handleOrderEvent(event)
      return { handled: true }
    default:
      return { handled: false }
  }
}

async function handleSubscriptionEvent(_event: PolarWebhookEvent): Promise<void> {
  const data = (_event?.data || {}) as Record<string, any>
  const customerObj = (data.customer || {}) as Record<string, any>
  const customerId = String(
    customerObj.id || data.customer_id || data.customerId || data.customer || ''
  ).trim()
  if (!customerId) return

  const customer = await upsertByField(CUSTOMER_COLLECTION, 'polarCustomerId', customerId, {
    email: String(customerObj.email || data.customer_email || '').trim() || undefined,
    name: String(customerObj.name || data.customer_name || '').trim() || undefined,
    metadata: customerObj || undefined,
  })

  const subscriptionId = String(data.id || data.subscription_id || data.subscriptionId || '').trim()
  if (!subscriptionId) return

  const interval = normalizeInterval(data.interval || data.recurring_interval || data.billing_interval)
  await upsertByField(SUBSCRIPTION_COLLECTION, 'polarSubscriptionId', subscriptionId, {
    customer: customer.id,
    status: String(data.status || '').toLowerCase() || 'active',
    productId: String(data.product_id || data.productId || '').trim() || 'unknown',
    interval,
    currentPeriodStart: toISO(data.current_period_start || data.currentPeriodStart),
    currentPeriodEnd: toISO(data.current_period_end || data.currentPeriodEnd),
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end || data.cancelAtPeriodEnd),
    metadata: data,
  })
}

async function handleOrderEvent(_event: PolarWebhookEvent): Promise<void> {
  return
}
