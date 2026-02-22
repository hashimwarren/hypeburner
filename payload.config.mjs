import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import authorsModule from './src/runtime-collections/Authors.cjs'
import polarCustomersModule from './src/runtime-collections/PolarCustomers.cjs'
import polarSubscriptionsModule from './src/runtime-collections/PolarSubscriptions.cjs'
import polarWebhookEventsModule from './src/runtime-collections/PolarWebhookEvents.cjs'
import postsModule from './src/runtime-collections/Posts.cjs'
import usersModule from './src/runtime-collections/Users.cjs'

const { Authors } = authorsModule
const { PolarCustomers } = polarCustomersModule
const { PolarSubscriptions } = polarSubscriptionsModule
const { PolarWebhookEvents } = polarWebhookEventsModule
const { Posts } = postsModule
const { Users } = usersModule

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  routes: {
    admin: '/cms',
    api: '/api',
  },
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Authors, Posts, PolarCustomers, PolarSubscriptions, PolarWebhookEvents],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'change-me',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
