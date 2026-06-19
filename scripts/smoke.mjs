#!/usr/bin/env node
import path from 'path'
import { config as loadDotenv } from 'dotenv'

loadDotenv({ path: path.resolve(process.cwd(), '.env.local') })
loadDotenv({ path: path.resolve(process.cwd(), '.env') })

const args = process.argv.slice(2)
const urlFlagIndex = args.indexOf('--url')
const positionalUrl = args.find((arg) => /^https?:\/\//.test(arg))
const appUrl =
  (urlFlagIndex >= 0 && args[urlFlagIndex + 1] && args[urlFlagIndex + 1]) ||
  positionalUrl ||
  process.env.SMOKE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL

if (!appUrl) {
  console.error('Usage: node scripts/smoke.mjs --url <https://your-preview-url>')
  process.exit(1)
}

const byPassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const strict = args.includes('--strict-protection')
const expectedLatestPostSlug = process.env.EXPECTED_LATEST_POST_SLUG
const expectedDraftPostSlug = process.env.EXPECTED_DRAFT_POST_SLUG

const paths = [
  '/',
  '/about',
  '/blog',
  '/tags',
  '/sitemap.xml',
  '/robots.txt',
  '/feed.xml',
  '/search.json',
]

function buildHeaders() {
  if (!byPassSecret) return {}
  return {
    'x-vercel-protection-bypass': byPassSecret,
  }
}

async function requestWithOptionalBypass(url) {
  const direct = await fetch(url)
  if (direct.status !== 401 && direct.status !== 403) {
    return direct
  }

  if (!byPassSecret) {
    throw new Error(`Route is protected and VERCEL_AUTOMATION_BYPASS_SECRET is not set for ${url}`)
  }

  const bypassed = await fetch(url, {
    headers: buildHeaders(),
  })
  return bypassed
}

async function checkPath(pathname) {
  const url = new URL(pathname, appUrl).toString()
  const response = await requestWithOptionalBypass(url)

  if (!response.ok) {
    throw new Error(`Expected 2xx for ${pathname}, got ${response.status}`)
  }

  const body = await response.text()
  if (body.includes('Internal Server Error') || body.includes('Application error:')) {
    throw new Error(`Page render failure for ${pathname}`)
  }

  if (strict && response.status === 200 && byPassSecret && response.url.includes('vercel.app')) {
    if (!response.headers.get('set-cookie')) {
      console.log(`[smoke] ${pathname}: bypass header used (no cookie available)`) // informational only
    }
  }

  console.log(`[smoke] ${pathname} -> ${response.status}`)
}

async function readPath(pathname) {
  const url = new URL(pathname, appUrl).toString()
  const response = await requestWithOptionalBypass(url)

  if (!response.ok) {
    throw new Error(`Expected 2xx for ${pathname}, got ${response.status}`)
  }

  return response
}

function expectIncludes(body, expected, label) {
  if (!body.includes(expected)) {
    throw new Error(`${label} did not include ${expected}`)
  }
}

function expectExcludes(body, unexpected, label) {
  if (body.includes(unexpected)) {
    throw new Error(`${label} unexpectedly included ${unexpected}`)
  }
}

async function checkPublishedPostSurfaces() {
  if (!expectedLatestPostSlug) return

  const encodedLatest = encodeURIComponent(expectedLatestPostSlug)
  const apiPath = `/api/posts?depth=0&limit=1&sort=-publishedAt&where[status][equals]=published`
  const api = await readPath(apiPath)
  const apiBody = await api.json()
  const actualLatestSlug = apiBody?.docs?.[0]?.slug

  if (actualLatestSlug !== expectedLatestPostSlug) {
    throw new Error(
      `Expected latest API post slug ${expectedLatestPostSlug}, got ${actualLatestSlug || 'none'}`
    )
  }

  const latestHref = `/blog/${expectedLatestPostSlug}`
  const blog = await readPath('/blog')
  const blogHtml = await blog.text()
  expectIncludes(blogHtml, latestHref, '/blog')

  const feed = await readPath('/feed.xml')
  const feedXml = await feed.text()
  expectIncludes(feedXml, latestHref, '/feed.xml')

  const search = await readPath('/search.json')
  const searchDocs = await search.json()
  const searchSlugs = Array.isArray(searchDocs) ? searchDocs.map((entry) => entry?.slug) : []
  if (!searchSlugs.includes(expectedLatestPostSlug)) {
    throw new Error(`/search.json did not include ${expectedLatestPostSlug}`)
  }

  if (expectedDraftPostSlug) {
    const draftHref = `/blog/${expectedDraftPostSlug}`
    expectExcludes(blogHtml, draftHref, '/blog')
    expectExcludes(feedXml, draftHref, '/feed.xml')
    if (searchSlugs.includes(expectedDraftPostSlug)) {
      throw new Error(`/search.json unexpectedly included ${expectedDraftPostSlug}`)
    }
  }

  console.log(`[smoke] published post surfaces include ${encodedLatest}`)
}

async function main() {
  console.log(`smoke check: ${appUrl}`)

  let failed = false
  for (const pathname of paths) {
    try {
      await checkPath(pathname)
    } catch (error) {
      failed = true
      console.error(error.message)
    }
  }

  try {
    await checkPublishedPostSurfaces()
  } catch (error) {
    failed = true
    console.error(error.message)
  }

  if (failed) {
    console.error('[smoke] one or more routes failed')
    process.exit(1)
  }

  console.log('[smoke] all routes passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
