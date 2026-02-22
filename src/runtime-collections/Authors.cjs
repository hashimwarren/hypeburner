const { adminOnlyWrite } = require('./access.cjs')

const normalizeAuthorSlug = (value) => String(value || '').trim().toLowerCase()

const Authors = {
  slug: 'authors',
  access: {
    read: () => true,
    create: adminOnlyWrite,
    update: adminOnlyWrite,
    delete: adminOnlyWrite,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data && typeof data === 'object' && 'slug' in data && data.slug) {
          data.slug = normalizeAuthorSlug(data.slug)
        }
        return data
      },
    ],
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'updatedAt'],
  },
  fields: [
    {
      name: 'name',
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
        const normalized = normalizeAuthorSlug(value)
        if (normalized.length === 0) {
          return 'Slug is required.'
        }
        if (normalized.includes('/')) {
          return 'Author slug must be a single path segment.'
        }
        return true
      },
    },
    {
      name: 'avatar',
      type: 'text',
    },
    {
      name: 'occupation',
      type: 'text',
    },
    {
      name: 'company',
      type: 'text',
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'twitter',
      type: 'text',
    },
    {
      name: 'bluesky',
      type: 'text',
    },
    {
      name: 'linkedin',
      type: 'text',
    },
    {
      name: 'github',
      type: 'text',
    },
    {
      name: 'layout',
      type: 'text',
    },
    {
      name: 'bioRichText',
      type: 'richText',
    },
  ],
  timestamps: true,
}

module.exports = {
  Authors,
}
