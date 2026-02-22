import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../../payload.config'
import { toKebabCaseSlug } from '@/components/lib/slug'
import { todayLocalYMD } from '@/components/lib/date'
import { markdownToLexical } from 'src/payload/lexical'

type SaveBody = {
  title: string
  summary?: string
  tags?: string[]
  draft?: boolean
  content: string
  slug?: string
  overwrite?: boolean
  date?: string
  folder?: 'root' | 'news' | 'newsletter'
}

function normalizeFolder(value: unknown): 'root' | 'news' | 'newsletter' {
  if (value === 'news' || value === 'newsletter') return value
  return 'root'
}

function buildFullSlug(folder: 'root' | 'news' | 'newsletter', slug: string): string {
  if (folder === 'root') return slug
  return `${folder}/${slug}`
}

function toIsoOrNow(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

async function getDefaultAuthorID(payload: Awaited<ReturnType<typeof getPayload>>) {
  const bySlug = await payload.find({
    collection: 'authors',
    where: {
      slug: {
        equals: 'default',
      },
    },
    limit: 1,
    depth: 0,
  })

  if (bySlug.docs[0]?.id) return bySlug.docs[0].id

  const fallback = await payload.find({
    collection: 'authors',
    limit: 1,
    depth: 0,
  })

  return fallback.docs[0]?.id
}

export async function POST(req: Request) {
  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Saving is disabled in production.' }, { status: 403 })
  }

  let body: SaveBody
  try {
    body = (await req.json()) as SaveBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, content, summary = '', tags = [], draft = false, overwrite = false } = body
  if (!title || !content) {
    return NextResponse.json({ error: 'Missing title or content' }, { status: 400 })
  }

  const leafSlug = toKebabCaseSlug(body.slug || title)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(leafSlug)) {
    return NextResponse.json({ error: 'Invalid slug format' }, { status: 400 })
  }

  const folder = normalizeFolder(body.folder)
  const slug = buildFullSlug(folder, leafSlug)
  const date = (body.date || todayLocalYMD()).trim()
  const payload = await getPayload({ config })

  const authorID = await getDefaultAuthorID(payload)
  if (!authorID) {
    return NextResponse.json(
      { error: 'Cannot save without at least one author in Payload.' },
      { status: 400 }
    )
  }

  const existing = await payload.find({
    collection: 'posts',
    where: {
      slug: {
        equals: slug,
      },
    },
    limit: 1,
    depth: 0,
  })

  if (existing.docs[0] && !overwrite) {
    return NextResponse.json({ error: 'Post already exists', slug: leafSlug }, { status: 409 })
  }

  const baseData = {
    title,
    slug,
    status: draft ? 'draft' : 'published',
    summary,
    publishedAt: toIsoOrNow(date),
    lastmod: toIsoOrNow(date),
    category: folder === 'root' ? undefined : folder,
    tags,
    authors: [authorID],
    layout: 'PostLayout',
    content: markdownToLexical(content),
    sourceMarkdown: content,
    legacySourcePath:
      folder === 'root' ? `data/blog/${leafSlug}.mdx` : `data/blog/${folder}/${leafSlug}.mdx`,
  }

  if (existing.docs[0]) {
    await payload.update({
      collection: 'posts',
      id: existing.docs[0].id,
      data: baseData,
      depth: 0,
      overrideAccess: true,
    })
  } else {
    await payload.create({
      collection: 'posts',
      data: baseData,
      depth: 0,
      overrideAccess: true,
    })
  }

  const relativePath =
    folder === 'news'
      ? `data/blog/news/${leafSlug}.mdx`
      : folder === 'newsletter'
        ? `data/blog/newsletter/${leafSlug}.mdx`
        : `data/blog/${leafSlug}.mdx`

  return NextResponse.json({ ok: true, slug: leafSlug, relativePath })
}
