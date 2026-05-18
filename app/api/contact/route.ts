import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// Error codes
const ErrorCodes = {
  MISSING_FIELDS: 'ERR_MISSING_FIELDS',
  INVALID_EMAIL: 'ERR_INVALID_EMAIL',
  EMAIL_SEND: 'ERR_EMAIL_SEND',
  MISSING_ENV_VARS: 'ERR_MISSING_ENV_VARS',
  REQUEST_PROCESSING: 'ERR_REQUEST_PROCESSING',
} as const

const CONTACT_FORM_FROM = process.env.CONTACT_FORM_FROM || 'Hypeburner <hello@hypeburner.com>'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: Request) {
  // Environment variable validation
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      {
        error: 'Server configuration error.',
        code: ErrorCodes.MISSING_ENV_VARS,
        message: 'Email service is not properly configured. Please contact the administrator.',
      },
      { status: 500 }
    )
  }

  if (!process.env.CONTACT_FORM_RECIPIENT) {
    return NextResponse.json(
      {
        error: 'Server configuration error.',
        code: ErrorCodes.MISSING_ENV_VARS,
        message: 'Email service is not properly configured. Please contact the administrator.',
      },
      { status: 500 }
    )
  }

  try {
    // Instantiate Resend lazily to avoid build-time env access
    const resend = new Resend(process.env.RESEND_API_KEY)
    const payload = await request.json()
    const name = String(payload?.name || '').trim()
    const email = String(payload?.email || '')
      .trim()
      .toLowerCase()
    const message = String(payload?.message || '').trim()

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        {
          error: 'Missing required fields.',
          code: ErrorCodes.MISSING_FIELDS,
          message: 'Name, email, and message are all required fields.',
        },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error: 'Invalid email format.',
          code: ErrorCodes.INVALID_EMAIL,
          message: 'Please provide a valid email address.',
        },
        { status: 400 }
      )
    }

    const escapedName = escapeHtml(name)
    const escapedEmail = escapeHtml(email)
    const escapedMessageHtml = escapeHtml(message).replace(/\n/g, '<br />')
    const text = [
      'New Contact Form Submission',
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      '',
      'Message:',
      message,
    ].join('\n')

    const emailHtml = `
      <div>
        <h1>New Contact Form Submission</h1>
        <p><strong>Name:</strong> ${escapedName}</p>
        <p><strong>Email:</strong> ${escapedEmail}</p>
        <p><strong>Message:</strong></p>
        <p>${escapedMessageHtml}</p>
      </div>
    `

    const { data, error } = await resend.emails.send(
      {
        from: CONTACT_FORM_FROM,
        to: process.env.CONTACT_FORM_RECIPIENT!,
        subject: `New services inquiry from ${name}`,
        html: emailHtml,
        text,
        replyTo: [email],
        tags: [{ name: 'source', value: 'contact_form' }],
      },
      {
        idempotencyKey: `contact-form/${email}/${Date.now()}`,
      }
    )

    if (error) {
      console.error('Error sending email:', error)
      return NextResponse.json(
        {
          error: 'Failed to send email.',
          code: ErrorCodes.EMAIL_SEND,
          message:
            'Unable to send your message at this time. Please try again later or contact us directly.',
          details: error.message || 'Email service error',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Email sent successfully!', data }, { status: 200 })
  } catch (error) {
    console.error('Error processing request:', error)
    return NextResponse.json(
      {
        error: 'Failed to process request.',
        code: ErrorCodes.REQUEST_PROCESSING,
        message: 'An unexpected error occurred. Please try again later.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
