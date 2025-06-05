import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { NewsletterAPI } from 'pliny/newsletter'
import siteMetadata from '@/data/siteMetadata'

export const dynamic = 'force-static'

const plinyNewsletterHandler = NewsletterAPI({
  // @ts-ignore
  provider: siteMetadata.newsletter.provider,
})

export async function POST(req: Request) {
  if (siteMetadata.newsletter.provider === 'resend') {
    try {
      if (!siteMetadata.newsletter.resendApiKey) {
        return NextResponse.json({ error: 'Resend API Key is not configured.' }, { status: 500 })
      }
      if (!siteMetadata.newsletter.resendAudienceId) {
        return NextResponse.json(
          { error: 'Resend Audience ID is not configured.' },
          { status: 500 }
        )
      }
      // Ensure siteMetadata.email is configured, as it's used for the 'from' field
      if (!siteMetadata.email) {
        return NextResponse.json(
          { error: 'Sender email (siteMetadata.email) is not configured.' },
          { status: 500 }
        )
      }

      const resend = new Resend(siteMetadata.newsletter.resendApiKey)

      // TODO: Placeholder for fetching latest newsletter data
      // For now, use a hardcoded subject and HTML content for testing.
      const subject = 'Test Newsletter from Hypeburner'
      const htmlContent = '<h1>Hello World!</h1><p>This is a test broadcast sent via API.</p>'

      // Note: resend.broadcasts.create is for sending a campaign to an audience.
      // This API route will trigger a new broadcast each time it's called.
      const broadcastResponse = await resend.broadcasts.create({
        audience_id: siteMetadata.newsletter.resendAudienceId,
        from: siteMetadata.email, // This email must be a verified sender in your Resend account
        subject: subject,
        html: htmlContent,
        name: `Test Broadcast - ${new Date().toISOString()}`, // Optional: for identification in Resend dashboard
      })

      if (broadcastResponse.error) {
        console.error('Resend broadcast error:', broadcastResponse.error)
        return NextResponse.json(
          { error: broadcastResponse.error.message || 'Failed to create broadcast.' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: 'Broadcast created successfully!',
        id: broadcastResponse.data?.id,
      })
    } catch (error) {
      console.error('Error in Resend POST handler:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.'
      return NextResponse.json(
        { error: `Failed to process request: ${errorMessage}` },
        { status: 500 }
      )
    }
  } else {
    // Fallback to pliny's handler for other providers
    // @ts-ignore
    return plinyNewsletterHandler(req)
  }
}

export async function GET(req: Request) {
  // If the provider is resend, this endpoint (as defined for POST) isn't for GET.
  // Pliny's handler might have GET methods for other providers (e.g., fetching subscribers)
  // which we are bypassing here if provider is resend.
  if (siteMetadata.newsletter.provider === 'resend') {
    return NextResponse.json({
      message:
        'GET method for Resend provider is not applicable for this broadcast endpoint. Use POST to trigger a broadcast.',
    })
  } else {
    // Fallback to pliny's handler for other providers
    // @ts-ignore
    return plinyNewsletterHandler(req)
  }
}
