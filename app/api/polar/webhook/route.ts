import { NextResponse } from 'next/server'

import { handlePolarWebhookEvent, isPolarWebhookProcessed, markPolarWebhookProcessed } from '../../../../lib/polar/events'
import { getPolarWebhookSecret } from '../../../../lib/polar/config'
import { PolarWebhookVerificationError, verifyAndParsePolarWebhook } from '../../../../lib/polar/webhook'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const payload = await req.text()

  try {
    const { event, webhookId } = verifyAndParsePolarWebhook(
      payload,
      req.headers,
      getPolarWebhookSecret()
    )

    if (await isPolarWebhookProcessed(webhookId)) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 202 })
    }

    const result = await handlePolarWebhookEvent(event)
    await markPolarWebhookProcessed(webhookId, event)

    return NextResponse.json(
      {
        ok: true,
        type: event.type,
        handled: result.handled,
      },
      { status: 202 }
    )
  } catch (error) {
    if (error instanceof PolarWebhookVerificationError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected server error' },
      { status: 500 }
    )
  }
}
