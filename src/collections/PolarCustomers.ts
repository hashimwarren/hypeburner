import type { CollectionConfig } from 'payload'
import { adminOnlyWrite, isAdmin } from './access'

export const PolarCustomers: CollectionConfig = {
  slug: 'polarCustomers',
  access: {
    read: isAdmin,
    create: adminOnlyWrite,
    update: adminOnlyWrite,
    delete: adminOnlyWrite,
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'polarCustomerId', 'updatedAt'],
  },
  fields: [
    {
      name: 'polarCustomerId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      unique: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'metadata',
      type: 'json',
    },
  ],
  timestamps: true,
}
