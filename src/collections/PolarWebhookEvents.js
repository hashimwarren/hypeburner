const { adminOnlyWrite, isAdmin } = require('./access.js')

const PolarWebhookEvents = {
  slug: 'polarWebhookEvents',
  access: {
    read: isAdmin,
    create: adminOnlyWrite,
    update: adminOnlyWrite,
    delete: adminOnlyWrite,
  },
  admin: {
    useAsTitle: 'webhookId',
    defaultColumns: ['webhookId', 'type', 'processed', 'receivedAt'],
  },
  fields: [
    {
      name: 'webhookId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'type',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'receivedAt',
      type: 'date',
      defaultValue: () => new Date(),
      required: true,
      index: true,
    },
    {
      name: 'processed',
      type: 'checkbox',
      defaultValue: false,
      index: true,
    },
    {
      name: 'processedAt',
      type: 'date',
    },
    {
      name: 'payload',
      type: 'json',
      required: true,
    },
    {
      name: 'error',
      type: 'textarea',
    },
  ],
  timestamps: true,
}

module.exports = {
  PolarWebhookEvents,
}
