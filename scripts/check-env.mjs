#!/usr/bin/env node
import path from 'path'
import { config as loadDotenv } from 'dotenv'

loadDotenv({ path: path.resolve(process.cwd(), '.env.local') })
loadDotenv({ path: path.resolve(process.cwd(), '.env') })

const deployment = process.env.VERCEL === '1' ? process.env.VERCEL_ENV || 'preview' : process.env.NODE_ENV || 'local'

const required = [
  'DATABASE_URI',
  'PAYLOAD_SECRET',
  'NEXT_PUBLIC_SITE_URL',
]

const missing = required.filter((name) => !process.env[name] || !String(process.env[name]).trim())

if (missing.length) {
  console.error(`Missing required environment variables for ${deployment}:`)
  for (const name of missing) {
    console.error(`- ${name}`)
  }
  process.exit(1)
}

console.log(`[env] ${deployment} contract checks passed`)
