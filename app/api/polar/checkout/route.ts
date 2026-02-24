import { NextResponse } from 'next/server'
import { z } from 'zod'
import { env } from 'lib/env'
import {
  PolarConfigError,
  PolarErrorCodes,
  PolarUpstreamError,
  callPolarApi,
  extractPolarUrl,
  getPayloadClient,
  resolveProductId,
} from 'lib/polar/server'

export const runtime = 'nodejs'

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

const requestSchema = z.object({
  interval: z.enum(['monthly', 'annual']),
  email: z.string().trim().email(),
  name: z.string().trim().min(1).max(120).optional(),
  userId: z.union([z.string().trim().min(1), z.number().int().positive()]).optional(),
  successUrl: z.string().trim().url().optional(),
  cancelUrl: z.string().trim().url().optional(),
  metadata: z.record(z.string(), scalarSchema).optional(),
})

function errorResponse(status: number, code: string, message: string, details?: unknown) {
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

function toUserId(value: string | number): string | number {
  if (typeof value === 'number') return value
  if (/^\d+$/.test(value)) return Number(value)
  return value
}

export async function POST(request: Request) {
  try {
    const parsedBody = requestSchema.safeParse(await request.json())
    if (!parsedBody.success) {
      return errorResponse(
        400,
        PolarErrorCodes.InvalidInput,
        'Invalid checkout payload.',
        parsedBody.error.flatten()
      )
    }

    const payloadClient = await getPayloadClient()
    const payloadData = parsedBody.data
    const normalizedEmail = payloadData.email.toLowerCase()
    const productId = resolveProductId(payloadData.interval)

    let resolvedEmail = normalizedEmail
    let resolvedName = payloadData.name
    let resolvedUserId: string | number | undefined

    if (payloadData.userId !== undefined) {
      const userId = toUserId(payloadData.userId)
      try {
        const userDoc = await payloadClient.findByID({
          collection: 'users',
          id: userId,
          overrideAccess: true,
          depth: 0,
        })
        resolvedUserId = userDoc.id as string | number
        if (typeof userDoc.email === 'string' && userDoc.email.trim()) {
          resolvedEmail = userDoc.email.trim().toLowerCase()
        }
        if (!resolvedName && typeof userDoc.name === 'string' && userDoc.name.trim()) {
          resolvedName = userDoc.name.trim()
        }
      } catch {
        return errorResponse(
          404,
          PolarErrorCodes.InvalidInput,
          'User not found for provided userId.'
        )
      }
    }

    const existingCustomer = await payloadClient.find({
      collection: 'polarCustomers',
      where: {
        email: {
          equals: resolvedEmail,
        },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const knownCustomerId = existingCustomer.docs?.[0]?.polarCustomerId
    const metadata = {
      ...(payloadData.metadata || {}),
      source: 'hypeburner-api',
      ...(resolvedUserId !== undefined ? { userId: String(resolvedUserId) } : {}),
    }

    const polarResult = await callPolarApi('/v1/checkouts', {
      product_id: productId,
      success_url: payloadData.successUrl || `${env.NEXT_PUBLIC_SITE_URL}/`,
      cancel_url: payloadData.cancelUrl || `${env.NEXT_PUBLIC_SITE_URL}/pricing`,
      customer_email: resolvedEmail,
      customer_name: resolvedName,
      customer_id: knownCustomerId || undefined,
      metadata,
    })

    const url = extractPolarUrl(polarResult)
    if (!url) {
      return errorResponse(
        502,
        PolarErrorCodes.Upstream,
        'Polar checkout response did not include a redirect URL.',
        polarResult
      )
    }

    return NextResponse.json(
      {
        ok: true,
        code: 'OK',
        url,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof PolarConfigError) {
      console.error('[polar checkout] config error', { message: error.message })
      return errorResponse(500, error.code, error.message)
    }

    if (error instanceof PolarUpstreamError) {
      console.error('[polar checkout] upstream error', {
        status: error.status,
        payload: error.payload,
      })
      return errorResponse(502, error.code, 'Polar checkout request failed.', error.payload)
    }

    console.error('[polar checkout] unexpected error', error)
    return errorResponse(500, PolarErrorCodes.ProcessingFailed, 'Unexpected checkout failure.')
  }
}
