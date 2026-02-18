import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import readingTime from 'reading-time'
import siteMetadata from '../data/siteMetadata.js'
import { getPublishedPosts, getTagCounts } from '../lib/cms/payload-adapter.mjs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const rootDir = path.resolve(dirname, '..')

function lexicalToText(node) {
  if (!node) return ''
  if (Array.isArray(node)) return node.map(lexicalToText).join('')
  if (node.type === 'text') return String(node.text || '')
  if (Array.isArray(node.children)) return node.children.map(lexicalToText).join(' ')
  return ''
}

function bodyText(post) {
  if (post?.body?.raw) return String(post.body.raw)
  if (post?.body?.lexical?.root) return lexicalToText(post.body.lexical.root)
  return ''
}

function getSearchOutputPath() {
  const searchPath = siteMetadata?.search?.kbarConfig?.searchDocumentsPath
  const fileName = path.basename(searchPath || 'search.json')
  return path.join(rootDir, 'public', fileName)
}

export default async function generatePayloadArtifacts() {
  const posts = await getPublishedPosts()
  const tagCounts = await getTagCounts({ includeDrafts: false })

  const searchDocs = posts.map((post) => {
    const text = bodyText(post)
    const rt = readingTime(text)
    return {
      title: post.title,
      date: post.date,
      tags: post.tags || [],
      draft: false,
      summary: post.summary || '',
      images: post.images || [],
      type: 'Blog',
      readingTime: {
        text: rt.text,
        minutes: Number(rt.minutes.toFixed(3)),
        time: rt.time,
        words: rt.words,
      },
      slug: post.slug,
      path: post.path,
      filePath: post.filePath || `blog/${post.slug}.mdx`,
      toc: post.toc || [],
      structuredData: post.structuredData || null,
    }
  })

  const tagOutputPath = path.join(rootDir, 'app', 'tag-data.json')
  const searchOutputPath = getSearchOutputPath()

  mkdirSync(path.dirname(tagOutputPath), { recursive: true })
  mkdirSync(path.dirname(searchOutputPath), { recursive: true })

  writeFileSync(tagOutputPath, `${JSON.stringify(tagCounts, null, 2)}\n`)
  writeFileSync(searchOutputPath, `${JSON.stringify(searchDocs)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('generate-payload-artifacts.mjs')) {
  generatePayloadArtifacts().catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
}
