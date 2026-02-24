import type { CollectionConfig } from 'payload'
import { adminOnlyWrite, publishedOrAdminRead } from './access'

const normalizePostSlug = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')

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
