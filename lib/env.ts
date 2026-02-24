import path from 'node:path'
import { config as loadDotenv } from 'dotenv'
import { z } from 'zod'

const loaded = new Set<string>()

function ensureEnvFilesLoaded() {
  if (loaded.has('payload-project')) return

  const rootDir = process.cwd()
  loadDotenv({ path: path.resolve(rootDir, '.env.local') })
  loadDotenv({ path: path.resolve(rootDir, '.env') })
  loaded.add('payload-project')
}

const envSchema = z.object({
  DATABASE_URI: z.string().trim().min(1, 'DATABASE_URI is required'),
  PAYLOAD_SECRET: z.string().trim().min(1, 'PAYLOAD_SECRET is required'),
  PAYLOAD_API_KEY: z.string().trim().optional(),
  PAYLOAD_LOCAL_API_URL: z.string().trim().optional(),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .trim()
    .default('http://localhost:3000')
    .transform((value) => value.replace(/\/$/, '')),
  PAYLOAD_POSTS_COLLECTION: z
    .string()
    .trim()
    .min(1, 'PAYLOAD_POSTS_COLLECTION cannot be empty')
    .default('posts'),
  PAYLOAD_AUTHORS_COLLECTION: z
    .string()
    .trim()
    .min(1, 'PAYLOAD_AUTHORS_COLLECTION cannot be empty')
    .default('authors'),
  PAYLOAD_QUERY_LIMIT: z.coerce.number().int().positive().default(1000),
  POLAR_ACCESS_TOKEN: z.string().trim().optional(),
  POLAR_WEBHOOK_SECRET: z.string().trim().optional(),
  POLAR_PRODUCT_ID_MONTHLY: z.string().trim().optional(),
  POLAR_PRODUCT_ID_ANNUAL: z.string().trim().optional(),
  POLAR_API_BASE_URL: z
    .string()
    .trim()
    .url('POLAR_API_BASE_URL must be a URL')
    .default('https://api.polar.sh'),
  RESEND_API_KEY: z.string().trim().optional(),
  CONTACT_FORM_RECIPIENT: z
    .string()
    .trim()
    .email('CONTACT_FORM_RECIPIENT must be an email')
    .optional(),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default(process.env.NODE_ENV || 'development'),
  VERCEL: z.enum(['0', '1']).optional(),
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
  VERCEL_AUTOMATION_BYPASS_SECRET: z.string().trim().optional(),
})

type EnvRuntimeShape = z.infer<typeof envSchema>

function summarizeEnvErrors(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')
}

function detectDeploymentMode(
  nodeEnv: 'development' | 'test' | 'production',
  isVercel: boolean,
  vercelEnv?: 'development' | 'preview' | 'production'
) {
  if (!isVercel) {
    return 'local'
  }

  if (vercelEnv === 'preview') {
    return 'preview'
  }

  if (vercelEnv === 'production') {
    return 'production'
  }

  return 'development'
}

export type EnvContract = EnvRuntimeShape & {
  isVercel: boolean
  deployment: 'local' | 'preview' | 'production' | 'development'
  includeDrafts: boolean
  isProduction: boolean
  isPreview: boolean
}

let cachedEnv: EnvContract | null = null

export function loadEnv(): EnvContract {
  if (cachedEnv) {
    return cachedEnv
  }

  ensureEnvFilesLoaded()

  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Environment validation failed:\n${summarizeEnvErrors(parsed.error)}`)
  }

  const base = parsed.data
  const isVercel = base.VERCEL === '1'
  const deployment = detectDeploymentMode(base.NODE_ENV, isVercel, base.VERCEL_ENV)
  const includeDrafts = deployment === 'local' && base.NODE_ENV !== 'production'

  const env = {
    ...base,
    isVercel,
    deployment,
    includeDrafts,
    isProduction: deployment === 'production',
    isPreview: deployment === 'preview',
  }

  cachedEnv = env as EnvContract
  return env as EnvContract
}

export const env = loadEnv()

export function withVercelBypassHeader(init: RequestInit = {}): RequestInit {
  if (!env.VERCEL_AUTOMATION_BYPASS_SECRET) return init

  const headers = new Headers(init.headers)
  headers.set('x-vercel-protection-bypass', env.VERCEL_AUTOMATION_BYPASS_SECRET)

  return {
    ...init,
    headers,
  }
}

export function assertVercelBypassSecret(scope = 'internal request') {
  if (env.VERCEL === '1' && !env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    throw new Error(
      `Vercel preview/prod internal request requires VERCEL_AUTOMATION_BYPASS_SECRET (${scope}). Set it in your deployment env settings.`
    )
  }
}
