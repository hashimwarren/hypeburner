import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPolar, PolarConfigurationError } from 'lib/polar/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const productsSchema = z.array(z.string().uuid()).min(1)

export async function GET(request: Request) {
  const products = productsSchema.safeParse(new URL(request.url).searchParams.getAll('products'))
  if (!products.success) {
    return NextResponse.json(
      { error: 'Provide at least one valid product ID using ?products=<id>.' },
      { status: 400 }
    )
  }

  try {
    const checkout = await getPolar().checkouts.create({ products: products.data })
    const response = NextResponse.redirect(checkout.url, 302)
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    if (error instanceof PolarConfigurationError) {
      return NextResponse.json({ error: 'Polar checkout is not configured.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Unable to create a Polar checkout.' }, { status: 502 })
  }
}
