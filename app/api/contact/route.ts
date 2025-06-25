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

// Environment variable validation
if (!process.env.RESEND_API_KEY) {
  throw new Error(
    'Missing required environment variable: RESEND_API_KEY. Please set this variable in your .env.local file.'
  )
}

if (!process.env.CONTACT_FORM_RECIPIENT) {
  throw new Error(
    'Missing required environment variable: CONTACT_FORM_RECIPIENT. Please set this variable in your .env.local file.'
  )
}

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { name, email, message } = await request.json()

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

    // Basic email validation
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
      to: process.env.CONTACT_FORM_RECIPIENT,
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
  } catch (err) {
    console.error('Error processing request:', err)
    // Check if err is an instance of Error to safely access err.message
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.'
    return NextResponse.json(
      {
        error: 'Failed to process request.',
        code: ErrorCodes.REQUEST_PROCESSING,
        message: 'An error occurred while processing your request. Please try again.',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}
