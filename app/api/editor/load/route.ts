import { NextResponse } from 'next/server'
import { lexicalToPlainText } from 'src/payload/lexical'
import { getPostBySlug } from 'src/payload/queries'

function toLocalDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().split('T')[0]
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    return NextResponse.json({ error: 'Loading is disabled in production.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug') || ''
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

  const post = await getPostBySlug(slug)
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const folder = post.slug.startsWith('newsletter/')
    ? 'newsletter'
    : post.slug.startsWith('news/')
      ? 'news'
      : 'root'

  const markdown = post.sourceMarkdown || lexicalToPlainText(post.content)

  return NextResponse.json({
    ok: true,
    data: {
      title: post.title,
      summary: post.summary ?? '',
      tags: post.tags ?? [],
      draft: Boolean(post.draft),
      slug: post.slug.includes('/') ? post.slug.split('/').pop() : post.slug,
      date: toLocalDate(post.date),
      folder,
      markdown,
    },
  })
}
