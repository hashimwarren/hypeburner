import { NextResponse } from 'next/server'
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks'
import { getPolarWebhookSecret, PolarConfigurationError } from 'lib/polar/client'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let event: ReturnType<typeof validateEvent>
  try {
    const secret = getPolarWebhookSecret()
    const body = await request.text()
    event = validateEvent(
      body,
      {
        'webhook-id': request.headers.get('webhook-id') ?? '',
        'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
        'webhook-signature': request.headers.get('webhook-signature') ?? '',
      },
      secret
    )
  } catch (error) {
    if (error instanceof PolarConfigurationError) {
      return NextResponse.json({ error: 'Polar webhooks are not configured.' }, { status: 503 })
    }
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ received: false }, { status: 403 })
    }
    return NextResponse.json({ received: false }, { status: 400 })
  }

  switch (event.type) {
    case 'order.paid':
      // TODO: Fulfill the paid order after the database/auth mapping is approved.
      // Deduplicate by webhook-id before introducing any side effects.
      break
    case 'customer.state_changed':
      // TODO: Sync customer access after the database/auth mapping is approved.
      // Deduplicate by webhook-id before introducing any side effects.
      break
  }

  return NextResponse.json({ received: true })
}
