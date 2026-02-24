import { NextResponse } from 'next/server'
import { getAllPosts } from 'src/payload/queries'

export async function GET() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    return NextResponse.json({ error: 'Listing is disabled in production.' }, { status: 403 })
  }

  const posts = await getAllPosts()
  const items = posts.map((post) => {
    const folder = post.slug.startsWith('newsletter/')
      ? 'newsletter'
      : post.slug.startsWith('news/')
        ? 'news'
        : 'root'
    return {
      title: post.title,
      slug: post.slug,
      summary: post.summary ?? '',
      draft: Boolean(post.draft),
      folder,
    }
  })

  // sort by title for UX
  items.sort((a, b) => a.title.localeCompare(b.title))

  return NextResponse.json({ ok: true, items })
}
