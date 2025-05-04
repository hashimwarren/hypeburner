import { NextRequest, NextResponse } from 'next/server'
import rateLimit from 'express-rate-limit'
import nodemailer from 'nodemailer'

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many requests, please try again later.',
})

export async function POST(req: NextRequest) {
  await limiter(req, res, () => {})

  const { name, email, subject, message } = await req.json()

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }

  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.CONTACT_EMAIL,
    subject: `Contact Form Submission: ${subject}`,
    text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
  }

  try {
    await transporter.sendMail(mailOptions)
    return NextResponse.json({ message: 'Message sent successfully!' }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send message. Please try again later.' }, { status: 500 })
  }
}
