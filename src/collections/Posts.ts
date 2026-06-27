import { slug as slugify } from 'github-slugger'
import { revalidatePath } from 'next/cache.js'
import type { CollectionConfig } from 'payload'
import { adminOnlyWrite, publishedOrAdminRead } from './access'

const normalizePostSlug = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')

type RevalidationDoc =
  | {
      slug?: unknown
      status?: unknown
      tags?: unknown
    }
  | null
  | undefined

const isPublishedPost = (doc: RevalidationDoc): boolean =>
  String(doc?.status || '')
    .trim()
    .toLowerCase() === 'published'

const toTagRouteSlugs = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []

  const tagSlugs = new Set<string>()
  for (const entry of value) {
    const normalized = slugify(String(entry || '').trim())
    if (normalized) {
      tagSlugs.add(normalized)
    }
  }

  return Array.from(tagSlugs)
}

const getPublishedPostPath = (doc: RevalidationDoc): string | null => {
  if (!isPublishedPost(doc)) return null

  const normalizedSlug = normalizePostSlug(doc?.slug)
  return normalizedSlug ? `/blog/${normalizedSlug}` : null
}

const collectPostRevalidationTargets = (doc: RevalidationDoc, previousDoc: RevalidationDoc) => {
  const specificPaths = new Set<string>()
  const dynamicPagePaths = new Map<string, 'page' | 'layout'>()

  if (!isPublishedPost(doc) && !isPublishedPost(previousDoc)) {
    return { specificPaths, dynamicPagePaths }
  }

  specificPaths.add('/')
  specificPaths.add('/blog')
  specificPaths.add('/tags')
  specificPaths.add('/sitemap.xml')
  specificPaths.add('/feed.xml')
  specificPaths.add('/search.json')

  dynamicPagePaths.set('/blog/page/[page]', 'page')
  dynamicPagePaths.set('/tags/[tag]', 'page')
  dynamicPagePaths.set('/tags/[tag]/page/[page]', 'page')

  const currentPostPath = getPublishedPostPath(doc)
  if (currentPostPath) {
    specificPaths.add(currentPostPath)
  }

  const previousPostPath = getPublishedPostPath(previousDoc)
  if (previousPostPath) {
    specificPaths.add(previousPostPath)
  }

  const affectedTags = new Set<string>([
    ...toTagRouteSlugs(doc?.tags),
    ...toTagRouteSlugs(previousDoc?.tags),
  ])

  for (const tagSlug of affectedTags) {
    specificPaths.add(`/tags/${tagSlug}`)
    specificPaths.add(`/tags/${tagSlug}/feed.xml`)
  }

  return { specificPaths, dynamicPagePaths }
}

const revalidatePostContent = (
  doc: RevalidationDoc,
  previousDoc: RevalidationDoc,
  payload: {
    logger: {
      info: (message: string) => void
      error: (args: { msg: string; err: unknown }) => void
    }
  },
  context?: { disableRevalidate?: boolean }
) => {
  if (context?.disableRevalidate) return

  const { specificPaths, dynamicPagePaths } = collectPostRevalidationTargets(doc, previousDoc)
  for (const path of specificPaths) {
    try {
      payload.logger.info(`Revalidating path: ${path}`)
      revalidatePath(path)
    } catch (error) {
      payload.logger.error({ msg: `Failed to revalidate path: ${path}`, err: error })
    }
  }

  for (const [path, type] of dynamicPagePaths) {
    try {
      payload.logger.info(`Revalidating ${type} pattern: ${path}`)
      revalidatePath(path, type)
    } catch (error) {
      payload.logger.error({
        msg: `Failed to revalidate ${type} pattern: ${path}`,
        err: error,
      })
    }
  }
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    read: publishedOrAdminRead,
    create: adminOnlyWrite,
    update: adminOnlyWrite,
    delete: adminOnlyWrite,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data && typeof data === 'object' && 'slug' in data && data.slug) {
          data.slug = normalizePostSlug(data.slug)
        }
        return data
      },
    ],
    afterChange: [
      ({ doc, previousDoc, req }) => {
        revalidatePostContent(doc, previousDoc, req.payload, req.context)
        return doc
      },
    ],
    afterDelete: [
      ({ doc, req }) => {
        revalidatePostContent(undefined, doc, req.payload, req.context)
        return doc
      },
    ],
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'publishedAt', 'updatedAt'],
  },
  versions: {
    drafts: {
      autosave: true,
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      validate: (value) => {
        const normalized = normalizePostSlug(value)
        if (normalized.length === 0) {
          return 'Slug is required.'
        }
        if (normalized.startsWith('/') || normalized.endsWith('/')) {
          return 'Slug must not include leading or trailing slashes.'
        }
        if (normalized.split('/').some((segment) => segment.trim().length === 0)) {
          return 'Slug cannot include empty path segments.'
        }
        return true
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      required: true,
      index: true,
    },
    {
      name: 'summary',
      type: 'text',
    },
    {
      name: 'lastmod',
      type: 'date',
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Newsletter', value: 'newsletter' },
        { label: 'News', value: 'news' },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      validate: (value, { siblingData }) => {
        const status = (siblingData as { status?: string } | undefined)?.status
        if (status === 'published' && !value) {
          return 'Published posts require a published date.'
        }
        return true
      },
      admin: {
        condition: (_, siblingData) => siblingData?.status === 'published',
      },
    },
    {
      name: 'tags',
      type: 'text',
      hasMany: true,
    },
    {
      name: 'authors',
      type: 'relationship',
      relationTo: 'authors',
      hasMany: true,
      minRows: 1,
      required: true,
      index: true,
    },
    {
      name: 'layout',
      type: 'select',
      options: [
        { label: 'PostLayout', value: 'PostLayout' },
        { label: 'PostSimple', value: 'PostSimple' },
        { label: 'PostBanner', value: 'PostBanner' },
      ],
      defaultValue: 'PostLayout',
    },
    {
      name: 'images',
      type: 'text',
      hasMany: true,
    },
    {
      name: 'bibliography',
      type: 'text',
    },
    {
      name: 'canonicalUrl',
      type: 'text',
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
    },
    {
      name: 'sourceMarkdown',
      type: 'textarea',
    },
    {
      name: 'legacySourcePath',
      type: 'text',
      unique: true,
      index: true,
    },
    {
      name: 'structuredData',
      type: 'json',
    },
  ],
  timestamps: true,
}
