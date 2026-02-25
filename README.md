# Hypeburner

Hypeburner covers the business of developer tools.

Hashim is a Product Marketer for developer tools startups. He’s led product marketing at Knock, Apollo GraphQL, WP Engine, Gatsby, and Coder Foundry, and now consults with early-stage startups to help them launch new products.

Outside of tech, Hashim serves refugee families in North Carolina through fundraising, arts programs, and small business support.

Outside of work, when he’s not working on messaging or mentoring, you can find him reading a book about church history, or thumbing through a good comic book.

## Environment Contract

A single validation module (`lib/env.ts`) now owns the runtime contract for launch-sensitive vars.
The goal is to fail fast when required values are missing and keep local, preview, and production behavior explicit.

### Required baseline

- `DATABASE_URI`
- `PAYLOAD_SECRET`
- `NEXT_PUBLIC_SITE_URL`

### Optional + provider values

- `PAYLOAD_API_KEY`
- `PAYLOAD_LOCAL_API_URL`
- `PAYLOAD_POSTS_COLLECTION` (default: `posts`)
- `PAYLOAD_AUTHORS_COLLECTION` (default: `authors`)
- `PAYLOAD_QUERY_LIMIT` (default: `1000`)
- `POLAR_ACCESS_TOKEN`
- `POLAR_WEBHOOK_SECRET`
- `POLAR_PRODUCT_ID_MONTHLY`
- `POLAR_PRODUCT_ID_ANNUAL`
- `POLAR_API_BASE_URL` (default: `https://api.polar.sh`)
- `RESEND_API_KEY`
- `CONTACT_FORM_RECIPIENT`
- `VERCEL_AUTOMATION_BYPASS_SECRET` (required for preview-protection bypass when calling internal routes)

### Ownership and environment scope

- Local development: `DATABASE_URI`, `PAYLOAD_SECRET`, optional service keys for local workflow.
- Preview deployment: same contract as production for deterministic rendering; provide `VERCEL_AUTOMATION_BYPASS_SECRET` when preview protection is enabled and internal checks call back into the deployment.
- Production: same required baseline plus any provider values used by enabled integrations.

## Deployment checklist

1. Populate environment variables and commit no secret values.
2. Run:
   - `yarn env:check`
   - `yarn build`
3. Confirm schema and payload startup paths can load with clear errors:
   - `payload.config.ts` imports `lib/env` and fails fast with explicit missing-variable messages.
4. If preview is protection-guarded, set `VERCEL_AUTOMATION_BYPASS_SECRET` in Vercel and mirror it in local smoke runs.

## Polar API routes

Launch billing entry points:

- `POST /api/polar/checkout`
- `POST /api/polar/portal`
- `POST /api/polar/webhook`

Response contract:

- Success: `{ ok: true, code: "OK", ... }`
- Failure: `{ ok: false, code: "ERR_*", message: string, details?: unknown }`

Route error codes:

- `ERR_POLAR_INVALID_INPUT`
- `ERR_POLAR_MISSING_CONFIG`
- `ERR_POLAR_UPSTREAM`
- `ERR_POLAR_CUSTOMER_NOT_FOUND`
- `ERR_POLAR_INVALID_SIGNATURE`
- `ERR_POLAR_INVALID_PAYLOAD`
- `ERR_POLAR_PROCESSING_FAILED`

## CMS route rendering settings

The following routes are explicit static routes using Payload-backed data so behavior is consistent in preview/production and avoids mixed rendering modes:

- `app/(site)/page.tsx`
- `app/(site)/about/page.tsx`
- `app/(site)/blog/page.tsx`
- `app/(site)/blog/[...slug]/page.tsx`
- `app/(site)/blog/page/[page]/page.tsx`
- `app/(site)/tags/page.tsx`
- `app/(site)/tags/[tag]/page.tsx`
- `app/(site)/tags/[tag]/page/[page]/page.tsx`
- `app/(site)/sitemap.ts`

## CMS Runtime Policy

Runtime content reads are CMS-first and archive markdown files are not used by public routes.

- Runtime source: Payload via `lib/cms`.
- Archive source: `data/` markdown remains in git for provenance and migration only.
- Local markdown editor routes were removed; content operations should use Payload admin at `/cms`.

## Migration Workflow

Use the migration script for deterministic dry runs and idempotent apply runs.

```bash
yarn migrate:payload
yarn migrate:payload:apply
```

Migration outputs:

- `scripts/reports/migration-report.json`
- `scripts/reports/migration-manual-fixes.json`

`migrate:payload:apply` runs in strict mode and fails when unsupported MDX constructs require manual cleanup.

## CSP hardening

`next.config.js` now centralizes script/connect/image/frame sources and keeps the policy explicit for the current known providers (`giscus`, `umami`, etc.).
If a new provider is enabled, add its domains here before enabling it in site config.

## Smoke checks

Use the repository-level smoke script after deployment to validate preview/prod routes:

```bash
yarn deploy:smoke -- --url https://your-deployment-url
```

Optional: `SMOKE_URL` env var can be used instead of `--url`.
If routes are protected and you need to simulate internal checks, ensure `VERCEL_AUTOMATION_BYPASS_SECRET` is set.

```bash
yarn deploy:smoke -- --url https://your-deployment-url --strict-protection
```

## CMS Artifact Generation

Tag/search artifacts are generated from published Payload content:

- `app/tag-data.json`
- `public/search.json` (or the configured `searchDocumentsPath` basename)

Run manually:

```bash
yarn artifacts:cms
```

Build hooks:

- `yarn build` runs `guard:runtime-cms`, Next build, then postbuild generation (`rss` + CMS artifacts).
