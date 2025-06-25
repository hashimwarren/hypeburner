# Project: Tailwind‑Nextjs‑Starter‑Blog (v2, App Router) + Pliny

This document provides a summary of the project's conventions, architecture, and key components.

## 1. Global rules

- **Language & tooling**

  - The project is written in **TypeScript** (`.tsx`, `.ts`) with `strict: true`.
  - It uses native `fetch` and **async/await** for asynchronous operations.
  - The project is configured with **ESLint** and **Prettier** for code quality and consistency.

- **Styling**

  - Styling is done using **Tailwind utility classes** directly in the markup.
  - It follows the core Tailwind breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) and spacing scale.
  - Blog post body text is styled with `@tailwindcss/typography`.

- **Components first**
  - The project emphasizes composition over duplication. Reusable components are located in `components/**`.

## 2. Content & filesystem layout

- **Blog posts** are located in `data/blog/*.mdx`.
  - Front-matter keys include `title`, `date`, `summary`, `tags`, and `draft`.
  - Slugs are generated from the filename in `lowercase-kebab-case`.
- The project uses the **App Router** for routing, with pages located in `app/(pages)/`. Interactive client components must include the `"use client"` directive.
- **Static assets** are stored in `public/` and should be referenced with absolute paths (e.g., `/images/foo.png`).

## 3. MDX helpers & Pliny modules

- Default MDX components are imported from `components/MDXComponents.tsx`.
- The project utilizes Pliny’s components for various features:
  - **Table of Contents**: `pliny/mdx` → `Toc` util
  - **Full-width sections**: `pliny/mdx` → `<Bleed>`
  - **Command palette**: `components/CommandPalette`
  - **SEO**: `<PlinySEO … />`
  - **Comments**: `<Comments />`
  - **Newsletter**: `<NewsletterForm />`

## 4. Images & media

- The project uses **`next/image`** for image optimization, requiring explicit `width` and `height` attributes.
- Remote image domains must be configured in `next.config.js`.
- Lazy-loading is handled automatically by Next.js.

## 5. Environment variables

- Environment variables are defined in `.env.example`.
- Public keys must be prefixed with `NEXT_PUBLIC_`.
- Environment variables are accessed using `process.env.<VAR>`.

## 6. Build, deploy & optimisation

- The project is built using `pnpm run build`.
- Unused CSS is purged by Tailwind’s `content` array.
- The deployment target is **Vercel**.

## 7. Testing, linting & CI

- Linting is performed with `pnpm run lint`.
- Unit tests are run with `pnpm run test` (Vitest).
- E2E tests are executed with Playwright (`npx playwright test`).
- The CI workflow enforces passing tests and ESLint checks.

## 8. Commit & PR etiquette

- The project follows the **Conventional Commits** specification.
- Pull requests should be kept small and include screenshots for UI changes.
- The `CHANGELOG.md` should be updated for every merge to `main`.
