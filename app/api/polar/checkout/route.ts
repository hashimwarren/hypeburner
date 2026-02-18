import { NextResponse } from 'next/server'

import { createCheckoutSession, PolarApiError } from '../../../../lib/polar/client'
import { buildSiteUrl, getPolarProductId, type PolarInterval } from '../../../../lib/polar/config'

type CheckoutRequestBody = {
  interval?: PolarInterval
  productId?: string
  customerId?: string
  externalCustomerId?: string
  successPath?: string
  returnPath?: string
  metadata?: unknown
}

type MetadataValue = string | number | boolean

function isPolarInterval(value: unknown): value is PolarInterval {
  return value === 'monthly' || value === 'annual'
}

function parseMetadata(metadata: unknown): Record<string, MetadataValue> | undefined {
  if (!metadata) {
    return undefined
  }

  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('metadata must be an object')
  }

  const parsed: Record<string, MetadataValue> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new Error(`metadata.${key} must be a string, number, or boolean`)
    }
    parsed[key] = value
  }

  return parsed
}

export async function POST(req: Request) {
  let body: CheckoutRequestBody = {}

  try {
    const raw = await req.text()
    body = raw ? (JSON.parse(raw) as CheckoutRequestBody) : {}
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.interval && !isPolarInterval(body.interval)) {
    return NextResponse.json({ error: 'interval must be either "monthly" or "annual"' }, { status: 400 })
  }

  const interval = body.interval ?? 'monthly'

  let metadata: Record<string, MetadataValue> | undefined
  try {
    metadata = parseMetadata(body.metadata)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid metadata' },
      { status: 400 }
    )
  }

  try {
    const productId = body.productId?.trim() || getPolarProductId(interval)
    const checkout = await createCheckoutSession({
      products: [productId],
      customer_id: body.customerId?.trim() || undefined,
      external_customer_id: body.externalCustomerId?.trim() || undefined,
      success_url: buildSiteUrl(body.successPath || '/billing/success'),
      return_url: buildSiteUrl(body.returnPath || '/pricing'),
      metadata,
    })

    return NextResponse.json(
      {
        ok: true,
        checkoutId: checkout.id ?? null,
        checkoutUrl: checkout.url ?? null,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof PolarApiError) {
      return NextResponse.json(
        { error: 'Failed to create Polar checkout session', details: error.details },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected server error' },
      { status: 500 }
    )
  }
}
