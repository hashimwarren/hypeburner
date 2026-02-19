# Deployment Root Cause Analysis (Payload + Neon + Polar rollout)

## Scope

This document explains what went wrong during the Vercel deployment cycle for the Payload/Neon/Polar integration, why it happened, what was changed, and how to prevent repeat incidents.

## Summary

There was not one single failure. The deployment issues came from three independent classes of problems:

1. Environment parity gaps between local and Vercel.
2. Next.js static/dynamic rendering mode mismatch on CMS-backed routes.
3. Preview/runtime platform constraints (Vercel preview protection + CSP).

All three produced overlapping symptoms (`No posts found`, `401`, `500`, `/cms` instability), which made diagnosis look noisy until each layer was isolated.

## User-visible symptoms

- Vercel builds failed or deployed with missing runtime behavior.
- Preview pages showed `No posts found` even when content existed.
- Individual post routes (for example `/blog/newsletter/...`) returned `500`.
- `/cms` initially failed (404/client-side runtime issues depending on preview state).
- Console showed CSP violations for `vercel.live` and `cloud.umami.is`.

## Root causes

### 1) Missing required env vars in Vercel

The app depends on server-side secrets (Neon, Payload, Polar, etc.). Local `.env.local` had values, but Vercel environments were initially incomplete.

Impact:

- CMS/data fetch logic could not fully initialize in preview.
- Incomplete runtime configuration masked as content/render failures.

Fix:

- Added required environment variables in Vercel for preview/production.
- Standardized variable names (for example `DATABASE_URI`, Payload/Polar secrets, product IDs, site URL, bypass secret).

### 2) Vercel preview protection blocked internal REST fallback calls

`lib/cms/payload-adapter.mjs` can fall back to REST API calls (same deployment) when local Payload API bootstrapping is unavailable.  
On protected preview deployments, those calls can return `401` without bypass headers.

Impact:

- Collection fetches resolved to empty data paths.
- UI showed `No posts found` despite seeded content.

Fix:

- Configured and used preview bypass secret in Vercel.
- Adapter already supports forwarding bypass headers/query via:
  - `VERCEL_AUTOMATION_BYPASS_SECRET` or `VERCEL_PROTECTION_BYPASS`
  - forwarded request auth headers in server context.

### 3) Static-to-dynamic mode mismatch in Next.js routes

CMS-backed routes were being treated as static while runtime data access used dynamic behavior (`fetch(..., { cache: 'no-store' })` in adapter REST fallback path).

Impact:

- Runtime `500` on post detail routes in preview (`app-static-to-dynamic-error`).

Fix:

- Forced dynamic rendering on CMS-backed pages:
  - `app/(site)/blog/[...slug]/page.tsx`
  - `app/(site)/blog/page.tsx`
  - `app/(site)/blog/page/[page]/page.tsx`
  - `app/(site)/tags/[tag]/page.tsx`
  - `app/(site)/tags/[tag]/page/[page]/page.tsx`
- Added `export const dynamic = 'force-dynamic'` to those routes.

### 4) CSP missing required script hosts for preview/runtime tooling

The configured CSP initially blocked scripts loaded from `vercel.live` and `cloud.umami.is`.

Impact:

- Console errors and client-side instability in preview.

Fix:

- Updated `next.config.js` CSP `script-src`/`connect-src` allowlist to include needed hosts.

## Contributing factors

- Multiple changes landed together (framework upgrade + CMS + DB + payments + deployment config), increasing blast radius.
- Symptom overlap: `401`, `500`, empty lists, and CSP errors appeared simultaneously.
- Preview protection introduced an additional auth layer not present in local development.

## What worked in the remediation

- Treating each class independently:
  - Build-time/config (envs),
  - Runtime data fetch/auth (bypass),
  - Render mode (dynamic),
  - Browser policy (CSP).
- Verifying preview URLs with bypass header after deploy.

## Prevention checklist (required before future deploys)

- Confirm Vercel env parity (Preview + Production) for all required server vars.
- Ensure preview bypass secret is configured if server-side self-fetch is used.
- For CMS-backed routes using `no-store`/request-bound data, explicitly set route dynamic mode.
- Validate CSP against all expected script/connect hosts used in production and preview tooling.
- Use a single package manager lockfile (Yarn in this repo); do not reintroduce `package-lock.json`.

## Quick verification runbook

1. Deploy preview.
2. Check public routes:
   - `/blog`
   - `/blog/newsletter/<known-slug>`
   - `/tags/<known-tag>`
3. Check CMS route:
   - `/cms`
4. If preview protection is enabled, verify with bypass header and confirm no `401` on internal content fetch path.
5. Confirm no CSP violations in browser console for required first-party tooling.
