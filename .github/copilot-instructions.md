# Copilot custom instructions for this repo

# ========================================

# Project: Tailwind‑Nextjs‑Starter‑Blog (v2, App Router) + Pliny

# Purpose: Teach Copilot our exact conventions so its proposals compile cleanly,

# look consistent, and avoid reinventing the wheel.

## ──────────────────────────────────

## 1. Global rules

## ──────────────────────────────────

- **Language & tooling**
  - Write **TypeScript** (`.tsx`, `.ts`) with `strict: true`. No JS output.
  - Use native `fetch` and **async/await**; do not import _axios_ or _node‑fetch_.
  - Respect existing **ESLint** and **Prettier** configs; assume `eslint.config.mjs` is source of truth :contentReference[oaicite:8]{index=8}.
- **Styling**
  - Apply **Tailwind utility classes** directly in markup; do **not** propose CSS‑in‑JS or inline styles :contentReference[oaicite:9]{index=9}.
  - Follow core Tailwind breakpoints (`sm md lg xl 2xl`) and spacing scale (`p‑4`, `gap‑6`, etc.).
  - Blog post body text size (styled with `@tailwindcss/typography`): Modify utility classes (e.g., `prose-lg`, `text-xl`) on the main content `div` within `layouts/PostLayout.tsx`.
- **Components first**
  - Prefer composition over duplication—reuse or extend components in `components/**`.

## ──────────────────────────────────

## 2. Content & filesystem layout

## ──────────────────────────────────

- **Blog posts** live in `data/blog/*.mdx`.
  - Front‑matter keys are `title`, `date`, `summary`, `tags`, `draft`. Keep them unchanged to satisfy Contentlayer schema :contentReference[oaicite:10]{index=10}.
  - Slugs equal the filename in _lowercase‑kebab‑case_.
- **App Router** routing: place pages in `app/(pages)/`. Any interactive client component must add `"use client"`.
- **Static assets** go in `public/`; reference with absolute paths (`/images/foo.png`).

## ──────────────────────────────────

## 3. MDX helpers & Pliny modules

## ──────────────────────────────────

- Import default MDX components from `components/MDXComponents.tsx`; never redeclare `<pre>`, `<code>`, or `<a>`.
- Use Pliny’s ready‑made components:  
  | Feature | Component/Hook | Notes |
  | ---------------------- | ---------------------------------- | ----- |
  | Table of Contents | `pliny/mdx` → `Toc` util | Pass `toc` prop; auto‑extracted by Remark plugin. |
  | Full‑width sections | `pliny/mdx` → `<Bleed>` | Breaks out of page padding :contentReference[oaicite:11]{index=11} |
  | Command palette | `components/CommandPalette` | Add new routes to `searchData.json`. |
  | SEO | `<PlinySEO … />` | **Never** insert `<Head>` manually. |
  | Comments | `<Comments />` | Provider chosen via `siteMetadata.comments.provider`. |
  | Newsletter | `<NewsletterForm />` | Calls `POST /api/newsletter`; no third‑party SDKs. |

## ──────────────────────────────────

## 4. Images & media

## ──────────────────────────────────

- Always use **`next/image`**. Supply explicit `width` and `height` to unlock Next.js optimisation :contentReference[oaicite:12]{index=12}.
- Remote images: add domains in `next.config.js > images.domains` :contentReference[oaicite:13]{index=13}.
- Lazy‑loading is automatic; don’t add `loading="lazy"` yourself :contentReference[oaicite:14]{index=14}.

## ──────────────────────────────────

## 5. Environment variables

## ──────────────────────────────────

- Reference keys from `.env.example`; do not hard‑code secrets :contentReference[oaicite:15]{index=15}.
- Public keys must start with `NEXT_PUBLIC_`.
- Use Vercel project settings for each _Development / Preview / Production_ env :contentReference[oaicite:16]{index=16}.
- Access with `process.env.<VAR>` inside server components or route handlers.

## ──────────────────────────────────

## 6. Build, deploy & optimisation

## ──────────────────────────────────

- Builds run `pnpm run build` → Next .js + Contentlayer.
- Purge unused CSS via Tailwind’s `content` array; production CSS is minified automatically (`tailwind --minify`) :contentReference[oaicite:17]{index=17}.
- Deployment target is **Vercel**, zero‑config for Next.js :contentReference[oaicite:18]{index=18}.
- Enforce `output: 'export'` only for static export experiments—otherwise rely on default serverless output.

## ──────────────────────────────────

## 7. Testing, linting & CI

## ──────────────────────────────────

- Run `pnpm run lint` before every commit (`eslint --max-warnings 0`).
- Use `pnpm run test` (Vitest) for unit tests; snapshots belong in `__snapshots__/`.
- **Playwright E2E tests**: Use `npx playwright test` for browser testing. Tests live in `__tests__/*.spec.ts`.
  - Contact form test: `__tests__/contact-form.spec.ts` validates form submission flow.
  - Start dev server (`yarn dev`) before running Playwright tests.
  - Tests use element IDs (`#name`, `#email`, `#message`) for reliable selectors.
- CI workflow blocks merge on failing tests or ESLint errors.

## ──────────────────────────────────

## 8. Commit & PR etiquette

## ──────────────────────────────────

- Conventional Commits (`feat:`, `fix:`, `chore:`).
- Keep PRs < 400 LOC diff; add screenshots for UI changes.
- Update `/CHANGELOG.md` for every `main` merge.

## ──────────────────────────────────

## 9. Copilot prompting tips (meta)

## ──────────────────────────────────

1. **Explain first** – ask “Explain this file” before requesting edits.
2. **Constrain scope** – specify language (TypeScript), folder, and framework nuances.
3. **Iterate** – adjust this instructions file whenever conventions change and reload Copilot (`⌘ K ⇧ S` in VS Code).

# End of instructions
