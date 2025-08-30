import { NextResponse } from 'next/server'
import { allBlogs } from 'contentlayer/generated'

export async function GET() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    return NextResponse.json({ error: 'Listing is disabled in production.' }, { status: 403 })
  }

  const items = allBlogs.map((b) => {
    const path = (b as { path?: string }).path
    const folder = path?.startsWith('blog/newsletter/')
      ? 'newsletter'
      : path?.startsWith('blog/news/')
        ? 'news'
        : 'root'
    return {
      title: b.title,
      slug: b.slug,
      summary: b.summary ?? '',
      draft: Boolean(b.draft),
      folder,
    }
  })

  // sort by title for UX
  items.sort((a, b) => a.title.localeCompare(b.title))

  return NextResponse.json({ ok: true, items })
}
