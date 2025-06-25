import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface ContactFormData {
  name: string
  email: string
  type: string
  message: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ContactFormData = await request.json()
    const { name, email, type, message } = body

    // Validate required fields
    if (!name || !email || !type || !message) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Compose and send email
    await resend.emails.send({
      from: `${name} <noreply@yourdomain.com>`, // Replace with your verified domain
      to: ['newsroom@yourdomain.com'], // Replace with your newsroom/sales email
      subject: `New ${type} inquiry from ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Type:</strong> ${type}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
      text: `
        New Contact Form Submission
        
        Name: ${name}
        Email: ${email}
        Type: ${type}
        Message: ${message}
      `,
      replyTo: email, // Allow direct reply to the sender
    })

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Error sending contact email:', error)

    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    )
  }
}
