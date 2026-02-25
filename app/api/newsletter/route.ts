import { NextResponse } from 'next/server'
import { env } from 'lib/env'

export const dynamic = 'force-dynamic'

const ErrorCodes = {
  InvalidEmail: 'ERR_INVALID_EMAIL',
  MissingConfig: 'ERR_MISSING_ENV_VARS',
  Upstream: 'ERR_NEWSLETTER_UPSTREAM',
} as const

type NewsletterResponse =
  | { ok: true; code: 'OK' | 'OK_ALREADY_SUBSCRIBED'; message: string }
  | { ok: false; code: string; message: string }

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isAlreadySubscribedError(error: { message?: string | null } | null | undefined): boolean {
  if (!error?.message) return false
  const message = error.message.toLowerCase()
  return message.includes('already exists') || message.includes('already subscribed')
}

async function createResendContact(apiKey: string, email: string) {
  const response = await fetch('https://api.resend.com/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      unsubscribed: false,
    }),
  })

  if (response.ok) {
    return { error: null as { message?: string | null } | null }
  }

  const parsedBody = (await response.json().catch(() => null)) as {
    message?: string
    error?: { message?: string }
  } | null

  const message =
    parsedBody?.message ||
    parsedBody?.error?.message ||
    `Resend contact request failed (${response.status})`

  return { error: { message } }
}

export async function POST(request: Request) {
  if (!env.RESEND_API_KEY) {
    const body: NewsletterResponse = {
      ok: false,
      code: ErrorCodes.MissingConfig,
      message: 'Newsletter signups are temporarily unavailable. Please try again later.',
    }
    return NextResponse.json(body, { status: 500 })
  }

  let payload: { email?: unknown } = {}

  try {
    payload = await request.json()
  } catch {
    // Treat empty/invalid JSON as empty payload for validation below.
  }

  const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : ''

  if (!email || !isValidEmail(email)) {
    const body: NewsletterResponse = {
      ok: false,
      code: ErrorCodes.InvalidEmail,
      message: 'Please enter a valid email address.',
    }
    return NextResponse.json(body, { status: 400 })
  }

  let error: { message?: string | null } | null = null
  try {
    const result = await createResendContact(env.RESEND_API_KEY, email)
    error = result.error
  } catch (requestError) {
    console.error('Newsletter subscribe error:', requestError)
    const body: NewsletterResponse = {
      ok: false,
      code: ErrorCodes.Upstream,
      message: "We couldn't subscribe you right now. Please try again shortly.",
    }
    return NextResponse.json(body, { status: 502 })
  }

  if (error) {
    if (isAlreadySubscribedError(error)) {
      const body: NewsletterResponse = {
        ok: true,
        code: 'OK_ALREADY_SUBSCRIBED',
        message: "You're already subscribed. Thanks for reading!",
      }
      return NextResponse.json(body, { status: 200 })
    }

    console.error('Newsletter subscribe error:', error)
    const body: NewsletterResponse = {
      ok: false,
      code: ErrorCodes.Upstream,
      message: "We couldn't subscribe you right now. Please try again shortly.",
    }
    return NextResponse.json(body, { status: 502 })
  }

  const body: NewsletterResponse = {
    ok: true,
    code: 'OK',
    message: 'You are subscribed. Welcome to the newsletter.',
  }
  return NextResponse.json(body, { status: 200 })
}
