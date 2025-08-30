import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

function toSlug(input: string) {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export async function POST(request: Request) {
  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Uploads are disabled in production.' }, { status: 403 })
  }

  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const alt = (formData.get('alt') as string) || ''

  if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const baseDir = path.join(process.cwd(), 'public', 'images', year, month)

  await fs.mkdir(baseDir, { recursive: true })

  const ext = path.extname(file.name) || '.png'
  const base = path.basename(file.name, ext)
  let name = `${toSlug(base)}${ext}`
  let outPath = path.join(baseDir, name)

  // ensure unique filename
  let counter = 1
  while (true) {
    try {
      await fs.stat(outPath)
      name = `${toSlug(base)}-${counter++}${ext}`
      outPath = path.join(baseDir, name)
    } catch {
      break
    }
  }

  await fs.writeFile(outPath, buffer)
  const publicPath = `/images/${year}/${month}/${name}`

  return NextResponse.json({ ok: true, src: publicPath, alt })
}
