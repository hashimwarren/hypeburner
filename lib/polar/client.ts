import { Polar } from '@polar-sh/sdk'

export class PolarConfigurationError extends Error {}

let polar: Polar | undefined

export function getPolar(): Polar {
  if (polar) return polar

  const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim()
  const server = process.env.POLAR_SERVER

  if (!accessToken) {
    throw new PolarConfigurationError('Missing POLAR_ACCESS_TOKEN')
  }
  if (server !== 'production' && server !== 'sandbox') {
    throw new PolarConfigurationError('POLAR_SERVER must be production or sandbox')
  }

  polar = new Polar({ accessToken, server, timeoutMs: 10_000 })
  return polar
}

export function getPolarWebhookSecret(): string {
  const secret = process.env.POLAR_WEBHOOK_SECRET?.trim()
  if (!secret) {
    throw new PolarConfigurationError('Missing POLAR_WEBHOOK_SECRET')
  }
  return secret
}
