import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  PolarConfigError,
  PolarErrorCodes,
  PolarUpstreamError,
  callPolarApi,
  extractPolarUrl,
  getPayloadClient,
} from 'lib/polar/server'

export const runtime = 'nodejs'

const requestSchema = z.object({
  customerId: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  userId: z.union([z.string().trim().min(1), z.number().int().positive()]).optional(),
})

type AuthUser = {
  id?: string | number
  role?: string
}

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

function sameIdentity(a: string | number, b: string | number) {
  return String(a) === String(b)
}

async function resolveCustomerId(
  customerId: string | undefined,
  email: string | undefined,
  userId: string | number | undefined
) {
  const payloadClient = await getPayloadClient()

  if (customerId) {
    const foundById = await payloadClient.find({
      collection: 'polarCustomers',
      where: {
        polarCustomerId: {
          equals: customerId,
        },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return foundById.docs?.[0] || null
  }

  if (email) {
    const foundByEmail = await payloadClient.find({
      collection: 'polarCustomers',
      where: {
        email: {
          equals: email.toLowerCase(),
        },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return foundByEmail.docs?.[0] || null
  }

  if (userId !== undefined) {
    const foundByUser = await payloadClient.find({
      collection: 'polarCustomers',
      where: {
        user: {
          equals: userId,
        },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return foundByUser.docs?.[0] || null
  }

  return null
}

async function createPortalSession(customerId: string) {
  const endpoints = ['/v1/customer-sessions', '/v1/customer-portal/sessions']
  let lastError: PolarUpstreamError | null = null

  for (const endpoint of endpoints) {
    try {
      return await callPolarApi(endpoint, { customer_id: customerId })
    } catch (error) {
      if (error instanceof PolarUpstreamError && error.status === 404) {
        lastError = error
        continue
      }
      throw error
    }
  }

  if (lastError) throw lastError
  throw new Error('Unable to create Polar portal session.')
}

export async function POST(request: Request) {
  try {
    const payloadClient = await getPayloadClient()
    const { user } = await payloadClient.auth({ headers: request.headers })
    const authUser = user as AuthUser | null

    if (!authUser?.id) {
      return errorResponse(
        401,
        PolarErrorCodes.Unauthorized,
        'Authentication required to create a customer portal session.'
      )
    }

    const isAdmin = authUser.role === 'admin'
    const parsedBody = requestSchema.safeParse(await request.json())
    if (!parsedBody.success) {
      return errorResponse(
        400,
        PolarErrorCodes.InvalidInput,
        'Invalid portal payload.',
        parsedBody.error.flatten()
      )
    }

    const parsedData = parsedBody.data
    let customer: Awaited<ReturnType<typeof resolveCustomerId>> = null

    if (isAdmin) {
      if (!parsedData.customerId && !parsedData.email && parsedData.userId === undefined) {
        return errorResponse(
          400,
          PolarErrorCodes.InvalidInput,
          'Provide at least one of customerId, email, or userId.'
        )
      }

      const targetUserId =
        parsedData.userId !== undefined ? toUserId(parsedData.userId as string | number) : undefined

      customer = await resolveCustomerId(parsedData.customerId, parsedData.email, targetUserId)
    } else {
      if (parsedData.customerId || parsedData.email) {
        return errorResponse(
          403,
          PolarErrorCodes.Unauthorized,
          'Non-admin users cannot look up portal sessions by customerId or email.'
        )
      }

      if (parsedData.userId !== undefined) {
        const requestedUserId = toUserId(parsedData.userId as string | number)
        if (!sameIdentity(requestedUserId, authUser.id)) {
          return errorResponse(
            403,
            PolarErrorCodes.Unauthorized,
            'Cannot request a portal session for another user.'
          )
        }
      }

      customer = await resolveCustomerId(undefined, undefined, authUser.id)
    }

    if (!customer || typeof customer.polarCustomerId !== 'string') {
      return errorResponse(
        404,
        PolarErrorCodes.CustomerNotFound,
        'No Polar customer found for the provided lookup fields.'
      )
    }

    const polarResult = await createPortalSession(customer.polarCustomerId)
    const url = extractPolarUrl(polarResult)

    if (!url) {
      return errorResponse(
        502,
        PolarErrorCodes.Upstream,
        'Polar portal response did not include a redirect URL.',
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
      console.error('[polar portal] config error', { message: error.message })
      return errorResponse(500, error.code, error.message)
    }

    if (error instanceof PolarUpstreamError) {
      console.error('[polar portal] upstream error', {
        status: error.status,
        payload: error.payload,
      })
      return errorResponse(502, error.code, 'Polar portal request failed.', error.payload)
    }

    console.error('[polar portal] unexpected error', error)
    return errorResponse(500, PolarErrorCodes.ProcessingFailed, 'Unexpected portal failure.')
  }
}
