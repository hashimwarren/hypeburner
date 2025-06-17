export async function POST(req: Request) {
  const { name, email, message } = await req.json()
  const { RESEND_API_KEY, RESEND_FROM, RESEND_TO } = process.env

  if (!RESEND_API_KEY || !RESEND_FROM || !RESEND_TO) {
    return new Response('Server not configured', { status: 500 })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: RESEND_TO,
      reply_to: email,
      subject: `Contact form submission from ${name}`,
      text: message,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(text)
    return new Response('Error sending email', { status: 500 })
  }

  return new Response(null, { status: 204 })
}
