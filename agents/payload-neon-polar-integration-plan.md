# Payload + Neon + Polar Integration Plan (Full Cutover, Design Preserved)

## Summary

Replace the current `contentlayer + MDX file` runtime with `Payload CMS + Neon Postgres` as the single source of truth, and add `Polar` subscription checkout + webhook syncing, while keeping the existing public UI/visual design intact.

Locked decisions:

- CMS scope: full cutover now
- Payments: subscriptions via Polar
- Access: no paywall yet
- Content body in CMS: Payload rich text
- Admin auth: Payload local auth
- Billing UX: CTA only on newsletter/blog content
- Cutover mode: hard switch immediately
- Legacy files: archive in repo, no runtime reads

## Public API / Interface Changes

1. New CMS admin

- `GET /cms` (Payload admin UI, local-auth protected)

2. New server endpoints

- `POST /api/polar/checkout`
  - Input: `{ email?: string, plan: "monthly" | "annual", successUrl?: string, cancelUrl?: string }`
  - Output: `{ url: string }` (hosted Polar checkout URL)
- `POST /api/polar/webhook`
  - Verifies Polar signature
  - Handles subscription/customer lifecycle events
  - Upserts subscription/customer records in Payload/Neon
- `POST /api/polar/portal` (optional but included in scope)
  - Input: `{ email: string }`
  - Output: `{ url: string }` (customer portal URL)

3. Removed runtime interfaces

- Remove runtime dependency on:
  - `contentlayer/generated`
  - file-based editor APIs under `app/api/editor/*`
- Remove "Edit this post" link to file editor in post page

## Data Model (Payload Collections in Neon)

1. `users` (admin auth)

- `email` (unique), `password`, `roles` (`admin` default)

2. `authors`

- `name`, `slug` (unique), `avatar`, `occupation`, `company`, `email`, `twitter`, `bluesky`, `linkedin`, `github`, `bioRichText`

3. `posts`

- `title`, `slug` (unique), `publishedAt`, `updatedAt`, `summary`
- `tags` (array of text)
- `status` (`draft` | `published`)
- `category` (`newsletter` | `news`)
- `authors` (relationship array to `authors`)
- `layout` (`PostLayout` | `PostSimple` | `PostBanner`)
- `images` (array of URLs)
- `content` (Payload Lexical rich text)
- `legacySourcePath` (text, archived provenance)

4. `polarCustomers`

- `email` (unique), `polarCustomerId` (unique), `name`

5. `polarSubscriptions`

- `polarSubscriptionId` (unique), `polarCustomerId`, `status`
- `productId`, `priceId`, `interval` (`month` | `year`)
- `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`

## Implementation Workstreams

1. Add dependencies and base config

- Add Payload + Postgres adapter + Lexical rich text + Polar SDK.
- Create `payload.config.ts` with:
  - `db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URI } })`
  - admin route mounted at `/cms`
  - collections listed above
  - rich text field config for `posts.content`
- Add env template values:
  - `DATABASE_URI` (Neon connection string)
  - `PAYLOAD_SECRET`
  - `POLAR_ACCESS_TOKEN`
  - `POLAR_WEBHOOK_SECRET`
  - `POLAR_PRODUCT_ID_MONTHLY`
  - `POLAR_PRODUCT_ID_ANNUAL`
  - `NEXT_PUBLIC_SITE_URL`

2. Replace content data layer without changing UI components

- Introduce a server-side query adapter in `lib/cms/` that returns the same shape currently consumed by:
  - `app/Main.tsx`
  - `app/blog/page.tsx`
  - `app/blog/[...slug]/page.tsx`
  - `app/tags/*`
  - `app/sitemap.ts`
  - `scripts/rss.mjs`
- Keep existing layout/components and CSS classes unchanged.
- Replace `MDXLayoutRenderer` usage with a Lexical renderer wrapper component that outputs content inside existing prose/layout containers.

3. Wire Polar subscriptions (no paywall)

- Add `app/api/polar/checkout/route.ts`
  - Create checkout session for chosen plan
- Add `app/api/polar/webhook/route.ts`
  - Verify signature
  - Handle events: subscription created/updated/canceled, customer created/updated
  - Upsert to `polarCustomers` and `polarSubscriptions`
- Add newsletter-only CTA:
  - In post page, render "Subscribe" CTA for newsletter/news posts only
  - CTA calls checkout endpoint and redirects to returned URL
  - Preserve existing visual style tokens/classes

4. Remove old runtime paths (hard switch)

- Delete file-editor routes/components:
  - `app/api/editor/list/route.ts`
  - `app/api/editor/load/route.ts`
  - `app/api/editor/save/route.ts`
  - `app/editor/*`
- Remove contentlayer imports/usages and generated-content assumptions in runtime code.
- Keep `data/blog` and `data/authors` in repo as archived content, but no runtime read path.

5. Content migration (MDX files -> Payload)

- Add one migration script under `scripts/`:
  - Read `data/authors/**/*.mdx`, create `authors` records
  - Read `data/blog/**/*.mdx`, parse frontmatter + body
  - Map folder to `category`
  - Map `draft` boolean to `status`
  - Import body into `posts.content` as Lexical rich text
  - Persist source path in `legacySourcePath`
- Idempotency:
  - Upsert by unique `slug`
  - Dry-run mode and apply mode
- Archive policy:
  - Keep files untouched in `data/` after successful import

## Testing and Acceptance Criteria

1. CMS/DB

- Admin login works at `/cms`
- Creating/editing/deleting post in Payload reflects on public pages
- Neon persistence confirmed across restarts/deploy

2. Frontend parity

- Home/blog/tag/post pages render with the same layout and styling classes
- Metadata, sitemap, and RSS still generate from CMS data
- No visual regression in typography/layout structure

3. Payments

- Checkout endpoint returns valid Polar checkout URL
- Webhook signature validation rejects invalid requests
- Valid webhook events create/update customer + subscription records
- Newsletter CTA visible only on intended content pages

4. Regression checks

- No import from `contentlayer/generated` remains in runtime files
- No runtime usage of file-based editor APIs remains
- Build succeeds with Payload + Next.js 16 integration

## Rollout / Operations

1. Staging first

- Provision Neon staging DB
- Configure Polar staging keys/webhook
- Run migration script in dry-run, then apply
- Smoke test CMS + frontend + checkout/webhooks

2. Production cutover

- Configure production env vars
- Run import once
- Deploy app
- Register production webhook URL in Polar
- Monitor webhook failures and DB writes first 24h

3. Backout plan

- Keep legacy `data/` files archived
- If severe issue, rollback deploy while preserving imported CMS data

## Explicit Assumptions / Defaults

- No public auth/paywall is introduced in this phase.
- Subscription status is tracked but not enforced for access control yet.
- Polar hosted checkout is used (no embedded custom checkout UI).
- Existing design means component/layout/CSS structure is preserved; only data source and editor backend change.
- Legacy MDX files remain in-repo as archive only.
