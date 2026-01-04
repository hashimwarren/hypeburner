# Payload + Neon Migration Plan for Hypeburner

---

## Overview

This document is the full, repo-specific migration plan to move Hypeburner from filesystem/Contentlayer MDX into a Payload CMS backed by Neon Postgres while preserving URLs, SEO, and look-and-feel.

It assumes the App Router architecture, MDX rendering with remark/rehype, and the existing folder-based nested-slug convention for posts under `data/blog/**`.

---

## 1) Current architecture (summary — key facts)

- Next.js: **App Router** (Next v15.2.4). Key files: `app/layout.tsx`, `app/page.tsx`, `app/blog/[...slug]/page.tsx`.
- Content storage: `data/blog/**/*.mdx` via **Contentlayer2 + Pliny** (see `contentlayer.config.ts`). Posts are MDX files; there are nested folders like `news/` and `newsletter/`.
- MDX pipeline: remark/re-hype stack as defined in `contentlayer.config.ts` (GFM, math, citations, `rehype-prism-plus`, KaTeX, autolink headings, etc.). MDX components in `components/MDXComponents.tsx`.
- Frontmatter schema: typed by Contentlayer. Required: `title`, `date`. Optional but used: `tags`, `summary`, `images`, `authors`, `draft`, `lastmod`, `canonicalUrl`.
- Routes/URLs: app uses `catch-all` `/blog/[...slug]` to support nested slugs. Pagination pages at `/blog/page/[page]`, tags at `/tags/[tag]`.
- SEO & metadata: Next Metadata API + per-post generation in `app/blog/[...slug]/page.tsx`. OG images come from frontmatter `images` or site defaults in `data/siteMetadata.js`.
- Search/Artifacts: `public/search.json`, `app/tag-data.json`, RSS under `public/feed.xml` generated via `scripts/rss.mjs` & `scripts/postbuild.mjs`.
- Editor: a dev-only filesystem editor exists under `app/api/editor/*` that writes MDX files.
- Deployment note: The repo had optional static export (`EXPORT=true`) used by a GitHub Pages workflow; we will remove it early.

---

## 2) Target architecture proposal (repo-specific)

**Decisions (short):**

- Keep **Next.js App Router**; do not migrate router mode.
- **Embed Payload** into the same Next app (admin at `/cms`) for same-domain SEO and simpler deployment (Vercel server-runtime). Avoid `/api` collisions by using `/cms` prefix.
- **Payload @latest**: follow current docs and install the latest Payload packages for Next + Postgres.
- **Neon Postgres** as DB; use `DATABASE_URL` in envs, one per environment (dev/preview/prod). Store posts in Payload with `bodyMdx` (raw MDX) to preserve the current MDX / remark / rehype behavior.
- **Authors in Payload**: add an `authors` collection (profile fields + MDX bio) and reference authors from posts via relationships for parity with Contentlayer.
- **Static generation**: keep SSG for blog routes; build-time queries hit Neon, and new content requires rebuilds or on-demand revalidation.
- **Media**: Initially keep images in `/public` (no rewriting) to preserve `components/Image.tsx` and existing paths. Optionally import to Payload Media later.

**Why MDX text:** The site relies on many MDX prerogatives (TOC, Prism, math, `rehype-citation`) and custom `MDXComponents`. Storing raw MDX retains parity and allows re-use of the rendering pipeline.

**Assumptions to verify (explicit):**

- ASSUMPTION: You will run Vercel/server runtime builds (i.e., we can retire `EXPORT=true` and GH Pages). Verify DNS/traffic does not depend on GH Pages.
- ASSUMPTION: Build environments have network access to Neon so SSG can fetch all posts/authors at build time.

---

## 3) Incremental migration strategy (phased)

We use small, reversible steps with a `USE_PAYLOAD` feature flag and a quick Phase 0 to remove static export early.

### Phase 0 — Remove static export (PR 0)

Goal: remove `EXPORT=true` workflow and make the repo server-runtime-only.

Files to change:

- `next.config.js` — remove/guard `process.env.EXPORT` behavior; fail fast if `EXPORT` set accidentally.
- `.github/workflows/pages.yml` — remove/disable the GH Pages release job.
- `scripts/rss.mjs` — remove `EXPORT` output switching; always write to `public/`.
- `scripts/postbuild.mjs` — keep artifacts writing to `public/` only.

Commands & checks:

- `pnpm run build` should succeed without producing `out/`.
- Ensure no traffic depends on GH pages.

Rollback: Revert the PR.

Risks: someone expected GH Pages deployment; mitigate by confirming DNS and stakeholders.

---

### Phase A — Add Payload & Neon (no customer-facing changes)

Goal: Install Payload, connect to Neon (dev DB), and make admin UI available at `/cms` without touching blog pages.

Files to add:

- `payload.config.ts` (new) — define `users` and base Payload config; add `posts`/`authors` collections in Phase B.
- `lib/payload/*` (new) — bootstrap helper for Payload server in development.
- `.env.example` — add placeholder `DATABASE_URL`, `PAYLOAD_SECRET`, and `USE_PAYLOAD=false`.

Commands:

- `pnpm add payload@latest @payloadcms/db-postgres@latest pg`
- `pnpm run dev` (verify `/cms` admin loads)

Acceptance:

- `/cms` admin loads locally and can connect to a Neon DB.
- No public page changes.

Rollback: revert PR; Contentlayer remains source of truth.

Risks: route collision — mitigation: host admin under `/cms`, do not use `/api/*` for Payload.

---

### Phase B — Create Payload collections (Posts, Users, optionally Tags/Media)

Goal: Mirror the Contentlayer `Blog` schema focusing on parity fields used by the app.

Collections/fields (minimal parity):

- `posts`
  - `title` (required)
  - `date` (required)
  - `slug` (required, unique, allow nested values like `news/foo`)
  - `summary`, `tags[]`, `draft`, `lastmod`, `images[]`, `canonicalUrl`, `layout`, `bibliography`
  - `authors` (relationship to `authors`, many)
  - `bodyMdx` (raw MDX string)
  - `filePath` (optional — preserves the "View on GitHub" link if kept)
- `authors`
  - `name` (required)
  - `slug` (required, unique)
  - `avatar`, `occupation`, `company`, `email`, `twitter`, `bluesky`, `linkedin`, `github`, `layout`
  - `bodyMdx` (raw MDX bio)
- `users` — for Payload admin authentication

Derived fields for parity (compute in adapter or persist in Payload on import):

- `posts.path` (e.g., `blog/news/foo`)
- `posts.toc`, `posts.structuredData`, `posts.body.code`
- `authors.path`, `authors.toc`, `authors.body.code`

Files to add:

- `payload.config.ts` (define `posts`, `authors`, `users` collections)
- `src/collections/Posts.ts` (if using collection files)
- `src/collections/Authors.ts` (if using collection files)

Acceptance:

- Admin can create posts with nested `slug` and MDX.
- Authors can be created and referenced by posts (default author exists).
- Drafts filterable in queries.

Rollback: keep collections until ready or drop tables in dev/staging DB.

---

### Phase C — Import script (MDX -> Payload, idempotent)

Goal: Write an idempotent importer that upserts authors + posts into Payload from `data/authors/**/*.mdx` and `data/blog/**/*.mdx`.

Script: `scripts/import-to-payload.ts` or `.mjs` (idempotent upsert by `slug`).

Order: import authors first, then posts (map author slugs to IDs).

Field mapping (posts):

- `title` → `title`
- `date` → `date`
- `summary` → `summary`
- `tags` → `tags[]`
- `draft` → `draft`
- `lastmod` → `lastmod`
- `images` (string|array) → normalized `images[]`
- `bibliography` → `bibliography`
- `authors` → relationship ids (by author slug)
- `canonicalUrl` → `canonicalUrl`
- MDX body (post-frontmatter) → `bodyMdx`
- `slug` derived from path: e.g. `data/blog/news/foo.mdx` → `news/foo`
- `path` derived as `blog/<slug>`
- `filePath` optional: store `blog/news/foo.mdx` if preserving "View on GitHub"

Field mapping (authors):

- `name` → `name`
- `avatar` → `avatar`
- `occupation` → `occupation`
- `company` → `company`
- `email` → `email`
- `twitter` → `twitter`
- `bluesky` → `bluesky`
- `linkedin` → `linkedin`
- `github` → `github`
- `layout` → `layout`
- MDX body (author bio) → `bodyMdx`
- `slug` derived from path: e.g. `data/authors/default.mdx` → `default`

Optional: compute and persist `toc`/`structuredData`/`body.code` during import to speed SSG builds.

Images policy: initially **keep local images under `/public`** and preserve paths; don't import media into Payload yet.

Commands:

- `pnpm node scripts/import-to-payload.mjs --create` (idempotent)

Acceptance:

- Import is repeatable and upserts correctly.
- A representative sample of posts and authors appear in Payload with matching title/slug/date/body.

Rollback:

- Delete imported records or reset DB for dev/test; source files remain the single source until Phase D.

---

### Phase D — Add content adapter + `USE_PAYLOAD` flag; switch read-paths incrementally (post route first)

Goal: Add an adapter layer that returns the same shape as Contentlayer outputs so you can switch pages one at a time behind `USE_PAYLOAD` environment flag.

Files to add/change:

- New adapter: `lib/content-adapter/*` (exposes `getAllPosts`, `getPostBySlug`, `getAllAuthors`, `getAuthorBySlug`, `getPostsByTag`, `getPagination`), returning objects shaped like Contentlayer `allBlogs`/`allAuthors`.
- New MDX compiler: `lib/mdx/*` (wraps existing remark/rehype config to produce `body.code`, `toc`, and `structuredData`).
- New artifacts generator: `scripts/generate-artifacts.mjs` to write `app/tag-data.json` and `public/search.json` from Payload data.

Switching order (recommended):

1. Post page & metadata: `app/blog/[...slug]/page.tsx`
2. About page (default author): `app/about/page.tsx`
3. Post listing & pagination: `app/blog/page.tsx`, `app/blog/page/[page]/page.tsx`, `app/page.tsx`
4. Tags list & pages: `app/tags/*`
5. Sitemap: `app/sitemap.ts`
6. RSS + artifacts: `scripts/rss.mjs`, `scripts/postbuild.mjs`, `scripts/generate-artifacts.mjs`

MDX rendering: reuse existing remark/rehype config (from `contentlayer.config.ts`) and `components/MDXComponents.tsx`; compile `bodyMdx` into `body.code` + `toc` + `structuredData` for posts, and `body.code` for authors, honoring `bibliography`, so behavior (TOC, Prism, KaTeX, citations) is unchanged.

Commands:

- Test builds with both paths:
  - `USE_PAYLOAD=0 pnpm run build` (baseline)
  - `USE_PAYLOAD=1 DATABASE_URL=... pnpm run build` (Payload path; requires Neon access)

Acceptance:

- With `USE_PAYLOAD=1`, post pages render identically for representative posts (title, content, TOC, code blocks, math, citations).
- `generateMetadata` outputs match for sample posts.
- About page renders the default author bio and social links from Payload.
- RSS, sitemap, search index generation works from Payload and matches counts/ordering for a sample set.

Rollback:

- Set `USE_PAYLOAD=0` and redeploy.

Risks + mitigations:

- MDX compile performance: add caching/compile-at-import to reduce request-time cost; consider precompiling during post-import step.

---

### Phase E — Remove Contentlayer & cleanup

Goal: Remove the old pipeline once parity is proven.

Files to remove/modify:

- `contentlayer.config.ts` and Contentlayer plugin references
- Contentlayer dependencies in `package.json`
- Optionally remove `app/api/editor/*` or convert it to use the Payload API as a dev helper

Acceptance:

- `pnpm build` succeeds w/o Contentlayer.
- All production pages read from Payload.

Rollback:

- Keep a backup branch with last Contentlayer setup and build artifacts until your DNS/traffic is fully on the new system.

---

## 4) Deliverables — checklist, file-by-file change list, parity test plan, PR sequence

### ✅ Execution checklist (condensed)

- [ ] PR 0: Remove GH Pages export path + `EXPORT` guard
- [ ] PR 1: Add Payload skeleton, env variables, admin at `/cms` (no public changes)
- [ ] PR 2: Add collections (`posts`, `authors`, `users`) to Payload
- [ ] PR 3: Add importer script (authors + MDX → Payload) and run in dev
- [ ] PR 4: Add adapter + `USE_PAYLOAD` flag; switch `app/blog/[...slug]/page.tsx` + `app/about/page.tsx`
- [ ] PR 5: Switch listing/tag/sitemap/rss/search + tag-data generation to Payload
- [ ] PR 6: Remove Contentlayer + cleanup routes + dependencies

### File-by-file (high-impact) change list

- New:

  - `payload.config.ts` ✅
  - `lib/payload/*` (Payload init helpers) ✅
  - `lib/content-adapter/*` (adapter returning Contentlayer-shaped objects) ✅
  - `lib/mdx/*` (MDX compile helpers) ✅
  - `scripts/import-to-payload.ts` (or `.mjs`) ✅
  - `scripts/generate-artifacts.mjs` ✅
  - `src/collections/Posts.ts` ✅
  - `src/collections/Authors.ts` ✅

- Modify:

  - `next.config.js` — remove `EXPORT` toggle (PR 0)
  - `.github/workflows/pages.yml` — delete (PR 0)
  - `scripts/rss.mjs` — remove `EXPORT` output switch and source from Payload (PR 0/PR 5)
  - `scripts/postbuild.mjs` — run artifact generation + RSS, write to `public/` (PR 0/PR 5)
  - `app/blog/[...slug]/page.tsx` — switch to adapter behind `USE_PAYLOAD` (PR 4)
  - `app/about/page.tsx` — switch to adapter for default author (PR 4)
  - `app/blog/page.tsx` & `app/blog/page/[page]/page.tsx` — update listing source (PR 5)
  - `app/tags/*` — update tag source (PR 5)
  - `app/sitemap.ts` — read from Payload (PR 5)
  - `.env.example` — add `DATABASE_URL`, `PAYLOAD_SECRET`, `USE_PAYLOAD`

- Remove (Phase E):
  - `contentlayer.config.ts` and Contentlayer deps
  - Optionally `app/api/editor/*`

### Parity test plan (representative checks)

- **Route parity**: compare `USE_PAYLOAD=0` vs `USE_PAYLOAD=1` for:
  - `/blog`, `/blog/page/2`
  - Example nested: `/blog/news/<slug>` and `/blog/newsletter/<slug>`
  - `/about`
  - `/tags/<tag>`, `/tags/<tag>/page/2`
  - `/feed.xml`, `/tags/<tag>/feed.xml`, `/sitemap.xml`
- **SEO parity** (3–5 posts):
  - Titles, meta descriptions, canonical URL, OG image behavior, JSON-LD presence
- **Rendering parity**:
  - TOC links, code block highlighting, KaTeX math rendering, citation rendering
  - Author card content on posts + About page bio render
  - Images referenced via local paths still show up as expected
- **Artifacts**:
  - `public/search.json` or equivalent search artifacts generated
  - Tag counts match (compare with `app/tag-data.json` before/after)

### PR sequence (recommended)

1. PR 0: Remove GH Pages export path (blocking) ✅
2. PR 1: Add Payload skeleton (no traffic changes)
3. PR 2: Add collections (Posts + Authors + Users)
4. PR 3: Importer (authors + posts → Payload)
5. PR 4: Adapter + feature flag; switch post route + About page
6. PR 5: Switch listings/tags/sitemap/rss/search + tag-data
7. PR 6: Remove Contentlayer + cleanup

---

## 5) Acceptance criteria (summary)

- All public routes remain accessible and their content equivalent after switching to Payload.
- RSS/Sitemap/Search produce the same artifacts (counts and URLs) after migration.
- MDX rendering features (TOC, Prism, KaTeX, citations) remain visually identical for posts and author bios.
- Admin can create/edit posts and authors in Payload; importer is idempotent.

---

## 6) Risks & mitigations (summary)

- **Static export compatibility**: mitigated by removing GH Pages early.
- **Build-time DB access**: SSG builds require Neon access; ensure `DATABASE_URL` is available in build environments.
- **Slug uniqueness / nested slugs**: enforce a unique `slug` in Payload and write importer which upserts by slug.
- **Author mapping**: import authors before posts and ensure the default author exists.
- **MDX parity**: reuse the same remark/rehype config; test on sample posts.
- **Media URL changes**: keep `public` paths initially; plan a later media migration.
- **Auth & security**: implement admin auth for Payload; secure admin at `/cms` with SSL and CSP.

---

## 7) TDD test plans

Tests should guide each phase. Define three suites (unit/integration/e2e) and run them via `pnpm test:unit`, `pnpm test:integration`, and `pnpm test:e2e`.

### Unit tests

- Validate `src/collections/Posts.ts`/`Authors.ts` schemas: required/date fields, unique slugs, relationships, and raw `bodyMdx` handling.
- Cover `lib/mdx` helpers by compiling sample MDX (math, citations, code blocks) and asserting `body.code`, `toc`, and `structuredData` output match expectations.
- Mock `lib/content-adapter` in `app/blog/[...slug]/page.tsx` and `app/about/page.tsx` to confirm `generateMetadata` and `MDXLayoutRenderer` receive the right props when `USE_PAYLOAD=1`.
- Unit-test importer helper functions: slug/path derivation, author slug resolution, and computed field defaults.

### Integration tests

- Bring up a Payload server (via `lib/payload/*`) backed by a test database (Neon dev branch or SQLite shim). Seed with importer output from `data/authors/*.mdx` and `data/blog/*.mdx`.
- Verify importer inserts authors before posts, linking relationships correctly, and populates derived fields (`path`, `toc`, `structuredData`).
- Run adapter queries against Payload to confirm `getAllPosts`, `getPostBySlug`, `getAllAuthors`, `getAuthorBySlug`, `getPostsByTag`, and artifact generators (`scripts/rss.mjs`, `scripts/generate-artifacts.mjs`) produce the expected `public/feed.xml`, `app/tag-data.json`, and `public/search.json`.
- Confirm `scripts/generate-artifacts.mjs` rebuilt tag counts match existing `app/tag-data.json` values and `public/search.json` contains `coreContent` output.

### E2E tests

- Launch Next dev server with `USE_PAYLOAD=1`, `DATABASE_URL` pointing to the seeded test Neon instance, and `PAYLOAD_SECRET` from `.env.example`.
- Exercise representative pages with Playwright:
  1. `/blog/<nested-slug>` – check breadcrumbs, title, TOC links, math rendering, and Prism highlighting.
  2. `/about` – ensure author bio, avatar, and social icons match imported author data.
  3. `/blog/page/2`, `/tags/<tag>`, `/feed.xml`, `/sitemap.xml` – verify status 200 and expected item counts.
- Validate `/cms` admin loads and draft filtering hides drafts in production render (simulate `draft=true` post).
- Run this suite before each PR merge (especially Phase D–E) to keep parity.

Automate the importer/adapter test data generation so each suite can bootstrap a predictable dataset (store fixtures under `__tests__/fixtures`).

## Next immediate steps I can take for you today

- Create the repository `payload.config.ts` and a minimal `lib/payload/` bootstrap so `/cms` works locally (Phase A PR draft).
- Or, if you prefer, make PR 0 to remove GH Pages and `EXPORT` first which simplifies the rest.

---

If you'd like me to begin implementing PR 0 (remove `pages.yml` and `EXPORT` toggle), say "Start PR 0" and I will make the changes and open files for review.
