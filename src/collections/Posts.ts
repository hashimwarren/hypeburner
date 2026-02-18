import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
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
      name: 'legacySourcePath',
      type: 'text',
    },
    {
      name: 'structuredData',
      type: 'json',
    },
  ],
  timestamps: true,
}
