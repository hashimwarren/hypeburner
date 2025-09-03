# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Development**: `npm run dev` or `yarn dev` - Start Next.js development server
- **Build**: `npm run build` - Build production version (includes contentlayer processing and postbuild script)
- **Production**: `npm run serve` - Serve production build locally
- **Testing**:
  - `npm test` - Run Jest unit tests
  - `npm run test:watch` - Jest in watch mode
  - `npm run test:coverage` - Jest with coverage report
  - `npx playwright test` - Run E2E tests (requires dev server running)
- **Linting**: `npm run lint` - Run ESLint with auto-fix
- **Bundle Analysis**: `npm run analyze` - Analyze bundle size

## Architecture Overview

This is a Next.js 15 blog application using:

### Core Stack

- **Next.js 15** with App Router (`app/` directory structure)
- **TypeScript** with strict mode enabled
- **Tailwind CSS** for styling with `@tailwindcss/typography` for blog content
- **Contentlayer2** for MDX blog post processing (configured in `contentlayer.config.ts`)
- **Pliny** library for blog utilities and components

### Content Management

- Blog posts are MDX files in `data/blog/*.mdx`
- Authors in `data/authors/*.mdx`
- Site configuration in `data/siteMetadata.js`
- Content processing generates:
  - Tag counts in `app/tag-data.json`
  - Search index for kbar in `public/search.json`

### Key Features

- **TipTap Editor**: Rich text editor with markdown support (`app/editor/`)
- **Search**: kbar-powered command palette search
- **Comments**: Giscus integration
- **Newsletter**: Mailchimp integration via API routes
- **Analytics**: Umami analytics support
- **Contact Form**: Resend email integration

### Directory Structure

- `app/` - Next.js App Router pages and API routes
- `components/` - Reusable React components including UI components and editor
- `layouts/` - Page layout components
- `data/` - Blog posts, authors, and site metadata
- `public/` - Static assets
- `css/` - Global styles and Tailwind config

### Important Patterns

- Use `"use client"` directive for interactive components
- MDX components are customized in `components/MDXComponents.tsx`
- All images should use `next/image` with explicit width/height
- Environment variables for public use must be prefixed with `NEXT_PUBLIC_`
- Blog post slugs are auto-generated from filename in kebab-case
- Security headers and CSP are configured in `next.config.js`

### Testing

- Jest configured for unit tests with `@testing-library/react`
- Playwright for E2E tests (contact form, editor functionality)
- Tests require development server running for E2E

### Deployment

- Configured for Vercel deployment
- Uses husky for git hooks and lint-staged for pre-commit checks
- Bundle analysis available via `@next/bundle-analyzer`
