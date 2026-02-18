import { NextResponse } from 'next/server'

import { createCustomerPortalSession, PolarApiError } from '../../../../lib/polar/client'
import { buildSiteUrl } from '../../../../lib/polar/config'

type PortalRequestBody = {
  customerId?: string
  externalCustomerId?: string
  returnPath?: string
}

export async function POST(req: Request) {
  let body: PortalRequestBody = {}

  try {
    const raw = await req.text()
    body = raw ? (JSON.parse(raw) as PortalRequestBody) : {}
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const customerId = body.customerId?.trim()
  const externalCustomerId = body.externalCustomerId?.trim()

  if (!customerId && !externalCustomerId) {
    return NextResponse.json(
      { error: 'Either customerId or externalCustomerId is required' },
      { status: 400 }
    )
  }

  try {
    const session = await createCustomerPortalSession({
      customer_id: customerId,
      external_customer_id: externalCustomerId,
      return_url: buildSiteUrl(body.returnPath || '/account/billing'),
    })

    return NextResponse.json(
      {
        ok: true,
        url: session.customer_portal_url ?? null,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof PolarApiError) {
      return NextResponse.json(
        { error: 'Failed to create Polar customer portal session', details: error.details },
        { status: error.status }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected server error' },
      { status: 500 }
    )
  }
}
