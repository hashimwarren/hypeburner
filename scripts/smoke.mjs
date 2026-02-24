#!/usr/bin/env node
import path from 'path'
import { config as loadDotenv } from 'dotenv'

loadDotenv({ path: path.resolve(process.cwd(), '.env.local') })
loadDotenv({ path: path.resolve(process.cwd(), '.env') })

const args = process.argv.slice(2)
const urlFlagIndex = args.indexOf('--url')
const appUrl =
  (urlFlagIndex >= 0 && args[urlFlagIndex + 1] && args[urlFlagIndex + 1]) ||
  process.env.SMOKE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL

if (!appUrl) {
  console.error('Usage: node scripts/smoke.mjs --url <https://your-preview-url>')
  process.exit(1)
}

const byPassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const strict = args.includes('--strict-protection')

const paths = ['/', '/about', '/blog', '/tags', '/sitemap.xml', '/robots.txt', '/feed.xml']

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
