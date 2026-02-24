import type { CollectionConfig } from 'payload'
import { adminOnlyWrite, isAdmin } from './access'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    read: isAdmin,
    create: adminOnlyWrite,
    update: adminOnlyWrite,
    delete: adminOnlyWrite,
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role', 'updatedAt'],
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'admin',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Author', value: 'author' },
        { label: 'Customer', value: 'customer' },
      ],
      required: true,
    },
  ],
  timestamps: true,
}
