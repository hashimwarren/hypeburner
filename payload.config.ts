import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import { Authors } from './src/collections/Authors'
import { PolarCustomers } from './src/collections/PolarCustomers'
import { PolarSubscriptions } from './src/collections/PolarSubscriptions'
import { PolarWebhookEvents } from './src/collections/PolarWebhookEvents'
import { Posts } from './src/collections/Posts'
import { Users } from './src/collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const payloadSecret = process.env.PAYLOAD_SECRET?.trim()

if (!payloadSecret) {
  throw new Error('PAYLOAD_SECRET is required for Payload config.')
}

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
  secret: payloadSecret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
