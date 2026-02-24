import type { CollectionConfig } from 'payload'
import { adminOnlyWrite, isAdmin } from './access'

export const PolarSubscriptions: CollectionConfig = {
  slug: 'polarSubscriptions',
  access: {
    read: isAdmin,
    create: adminOnlyWrite,
    update: adminOnlyWrite,
    delete: adminOnlyWrite,
  },
  admin: {
    useAsTitle: 'polarSubscriptionId',
    defaultColumns: ['polarSubscriptionId', 'status', 'interval', 'currentPeriodEnd'],
  },
  fields: [
    {
      name: 'polarSubscriptionId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'polarCustomers',
      required: true,
      index: true,
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
    },
    {
      name: 'productId',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'interval',
      type: 'select',
      options: [
        { label: 'Monthly', value: 'monthly' },
        { label: 'Annual', value: 'annual' },
      ],
      required: true,
      index: true,
    },
    {
      name: 'status',
      type: 'text',
      defaultValue: 'active',
      required: true,
      index: true,
    },
    {
      name: 'currentPeriodStart',
      type: 'date',
    },
    {
      name: 'currentPeriodEnd',
      type: 'date',
      index: true,
    },
    {
      name: 'cancelAtPeriodEnd',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'canceledAt',
      type: 'date',
    },
    {
      name: 'metadata',
      type: 'json',
    },
  ],
  timestamps: true,
}
