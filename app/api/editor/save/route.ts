import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { toKebabCaseSlug } from '@/components/lib/slug'
import { todayLocalYMD } from '@/components/lib/date'

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

function escapeYAML(str: string) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
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

  const slug = toKebabCaseSlug(body.slug || title)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug format' }, { status: 400 })
  }

  const date = (body.date || todayLocalYMD()).trim()
  const folder = body.folder || 'root'

  const fmLines = [
    '---',
    `title: "${escapeYAML(title)}"`,
    `date: ${date}`,
    `summary: "${escapeYAML(summary)}"`,
    `tags: [${tags.map((t) => `"${escapeYAML(t)}"`).join(', ')}]`,
    `draft: ${draft ? 'true' : 'false'}`,
    '---',
    '',
  ]
  const mdx = fmLines.join('\n') + content.trim() + '\n'

  const baseDir = path.join(process.cwd(), 'data', 'blog')
  const targetDir =
    folder === 'news'
      ? path.join(baseDir, 'news')
      : folder === 'newsletter'
        ? path.join(baseDir, 'newsletter')
        : baseDir
  const filePath = path.join(targetDir, `${slug}.mdx`)

  try {
    await fs.mkdir(targetDir, { recursive: true })
    try {
      const stat = await fs.stat(filePath)
      if (stat.isFile() && !overwrite) {
        return NextResponse.json({ error: 'File already exists', slug, filePath }, { status: 409 })
      }
    } catch {
      // file does not exist; proceed to write
    }
    await fs.writeFile(filePath, mdx, 'utf8')
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to write file', details: String(err) },
      { status: 500 }
    )
  }

  const relativePath =
    folder === 'news'
      ? `data/blog/news/${slug}.mdx`
      : folder === 'newsletter'
        ? `data/blog/newsletter/${slug}.mdx`
        : `data/blog/${slug}.mdx`

  return NextResponse.json({ ok: true, slug, relativePath })
}
