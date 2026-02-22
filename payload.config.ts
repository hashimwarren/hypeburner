import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'

const require = createRequire(import.meta.url)
const { Authors } = require('./src/runtime-collections/Authors.cjs')
const { PolarCustomers } = require('./src/runtime-collections/PolarCustomers.cjs')
const { PolarSubscriptions } = require('./src/runtime-collections/PolarSubscriptions.cjs')
const { PolarWebhookEvents } = require('./src/runtime-collections/PolarWebhookEvents.cjs')
const { Posts } = require('./src/runtime-collections/Posts.cjs')
const { Users } = require('./src/runtime-collections/Users.cjs')

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
