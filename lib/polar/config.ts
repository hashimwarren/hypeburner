export type PolarInterval = 'monthly' | 'annual'

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getPolarAccessToken(): string {
  return getRequiredEnv('POLAR_ACCESS_TOKEN')
}

export function getPolarWebhookSecret(): string {
  return getRequiredEnv('POLAR_WEBHOOK_SECRET')
}

export function getSiteUrl(): string {
  const siteUrl = getRequiredEnv('NEXT_PUBLIC_SITE_URL')
  try {
    return new URL(siteUrl).toString().replace(/\/$/, '')
  } catch {
    throw new Error('Invalid NEXT_PUBLIC_SITE_URL value')
  }
}

export function getPolarProductId(interval: PolarInterval): string {
  if (interval === 'monthly') {
    return getRequiredEnv('POLAR_PRODUCT_ID_MONTHLY')
  }

  return getRequiredEnv('POLAR_PRODUCT_ID_ANNUAL')
}

export function buildSiteUrl(pathname: string): string {
  return new URL(pathname, `${getSiteUrl()}/`).toString()
}

