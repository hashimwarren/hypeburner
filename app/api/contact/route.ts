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

// Instantiate Resend once outside the handler for better performance
let resendInstance: Resend | null = null

function getResendInstance() {
  if (!resendInstance && process.env.RESEND_API_KEY) {
    resendInstance = new Resend(process.env.RESEND_API_KEY)
  }
  return resendInstance
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
    const resend = getResendInstance()
    if (!resend) {
      throw new Error('Failed to initialize email service')
    }
    const { name, email, message } = await request.json()

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

    const emailHtml = `
      <div>
        <h1>New Contact Form Submission</h1>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      </div>
    `

    const { data, error } = await resend.emails.send({
      from: 'Contact Form <onboarding@resend.dev>',
      to: process.env.CONTACT_FORM_RECIPIENT!,
      subject: 'New Contact Form Submission',
      html: emailHtml,
    })

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
