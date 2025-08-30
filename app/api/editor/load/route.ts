import { NextResponse } from 'next/server'
import { allBlogs } from 'contentlayer/generated'

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    return NextResponse.json({ error: 'Loading is disabled in production.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug') || ''
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

  const doc = allBlogs.find((b) => b.type === 'Blog' && b.slug === slug)
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const path = (doc as { path?: string }).path
  const folder = path?.startsWith('blog/newsletter/')
    ? 'newsletter'
    : path?.startsWith('blog/news/')
      ? 'news'
      : 'root'

  // Return front matter-ish fields and raw markdown
  return NextResponse.json({
    ok: true,
    data: {
      title: doc.title,
      summary: doc.summary ?? '',
      tags: doc.tags ?? [],
      draft: Boolean(doc.draft),
      slug: doc.slug,
      date: doc.date,
      folder,
      markdown: doc.body.raw,
    },
  })
}
