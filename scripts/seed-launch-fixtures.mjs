import { mkdtempSync, rmSync } from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { build } from 'esbuild'
import { config as loadDotenv } from 'dotenv'

const rootDir = process.cwd()

loadDotenv({ path: path.resolve(rootDir, '.env.local') })
loadDotenv({ path: path.resolve(rootDir, '.env') })

function hasFlag(flag) {
  return process.argv.slice(2).includes(flag)
}

function markdownToLexical(markdown) {
  const normalized = String(markdown || '').replace(/\r\n/g, '\n').trim()
  const blocks = normalized ? normalized.split(/\n{2,}/) : ['']

  return {
    root: {
      children: blocks.map((block) => ({
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: block,
            type: 'text',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
        textFormat: 0,
        textStyle: '',
      })),
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}

async function createPayloadClient() {
  const tempDir = mkdtempSync(path.join(rootDir, '.tmp-payload-config-'))
  const outputPath = path.join(tempDir, 'payload.config.mjs')

  try {
    await build({
      entryPoints: [path.resolve(rootDir, 'payload.config.ts')],
      outfile: outputPath,
      bundle: true,
      packages: 'external',
      platform: 'node',
      format: 'esm',
      target: 'node20',
      sourcemap: false,
    })

    const configModule = await import(pathToFileURL(outputPath).href)
    const config = configModule?.default || configModule
    const payloadModule = await import('payload')
    return await payloadModule.getPayload({ config })
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

async function upsertByField(payload, collection, field, value, data, apply) {
  const existing = await payload.find({
    collection,
    where: {
      [field]: {
        equals: value,
      },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const doc = existing.docs?.[0]
  if (!apply) {
    console.log(`[dry-run] ${doc ? 'update' : 'create'} ${collection}: ${field}=${value}`)
    return doc || { id: `dry-run:${collection}:${value}` }
  }

  if (doc?.id) {
    const updated = await payload.update({
      collection,
      id: doc.id,
      data,
      depth: 0,
      overrideAccess: true,
    })
    console.log(`[apply] updated ${collection}: ${field}=${value}`)
    return updated
  }

  const created = await payload.create({
    collection,
    data,
    depth: 0,
    overrideAccess: true,
  })
  console.log(`[apply] created ${collection}: ${field}=${value}`)
  return created
}

async function run() {
  const apply = hasFlag('--apply')
  if (!apply && !hasFlag('--dry-run')) {
    console.log('No mode flag passed; defaulting to dry-run. Use --apply to persist fixtures.')
  }

  const payload = await createPayloadClient()
  try {
    const now = new Date().toISOString()

    const user = await upsertByField(
      payload,
      'users',
      'email',
      'launch-admin@hypeburner.com',
      {
        email: 'launch-admin@hypeburner.com',
        password: 'ChangeMe123!',
        name: 'Launch Admin',
        role: 'admin',
      },
      apply
    )

    const author = await upsertByField(
      payload,
      'authors',
      'slug',
      'default',
      {
        name: 'Launch Author',
        slug: 'default',
        bioRichText: markdownToLexical('Launch fixture author profile.'),
        email: 'editor@hypeburner.com',
      },
      apply
    )

    await upsertByField(
      payload,
      'posts',
      'slug',
      'newsletter/launch-fixture',
      {
        title: 'Launch Fixture Newsletter',
        slug: 'newsletter/launch-fixture',
        status: 'published',
        summary: 'Fixture post for staging smoke tests.',
        publishedAt: now,
        lastmod: now,
        category: 'newsletter',
        tags: ['launch', 'fixture'],
        authors: [author.id],
        layout: 'PostLayout',
        content: markdownToLexical('This is the launch fixture newsletter post body.'),
        sourceMarkdown: 'This is the launch fixture newsletter post body.',
        legacySourcePath: 'data/blog/newsletter/launch-fixture.mdx',
      },
      apply
    )

    await upsertByField(
      payload,
      'posts',
      'slug',
      'news/platform-fixture',
      {
        title: 'Platform Fixture Update',
        slug: 'news/platform-fixture',
        status: 'draft',
        summary: 'Draft fixture post for editor checks.',
        publishedAt: now,
        lastmod: now,
        category: 'news',
        tags: ['platform', 'fixture'],
        authors: [author.id],
        layout: 'PostLayout',
        content: markdownToLexical('This is the draft fixture post body.'),
        sourceMarkdown: 'This is the draft fixture post body.',
        legacySourcePath: 'data/blog/news/platform-fixture.mdx',
      },
      apply
    )

    const customer = await upsertByField(
      payload,
      'polarCustomers',
      'polarCustomerId',
      'fixture_customer_001',
      {
        polarCustomerId: 'fixture_customer_001',
        email: 'fixture-customer@hypeburner.com',
        name: 'Fixture Customer',
        user: user.id,
        metadata: { source: 'seed-launch-fixtures' },
      },
      apply
    )

    await upsertByField(
      payload,
      'polarSubscriptions',
      'polarSubscriptionId',
      'fixture_subscription_001',
      {
        polarSubscriptionId: 'fixture_subscription_001',
        customer: customer.id,
        user: user.id,
        productId: process.env.POLAR_PRODUCT_ID_MONTHLY || 'fixture_product_monthly',
        interval: 'monthly',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: now,
        cancelAtPeriodEnd: false,
        metadata: { source: 'seed-launch-fixtures' },
      },
      apply
    )

    await upsertByField(
      payload,
      'polarWebhookEvents',
      'webhookId',
      'fixture_webhook_001',
      {
        webhookId: 'fixture_webhook_001',
        type: 'subscription.created',
        receivedAt: now,
        processed: true,
        processedAt: now,
        payload: { source: 'seed-launch-fixtures', id: 'fixture_webhook_001' },
      },
      apply
    )
  } finally {
    if (typeof payload.destroy === 'function') {
      await payload.destroy()
    } else if (payload?.db && typeof payload.db.destroy === 'function') {
      await payload.db.destroy()
    }
  }
}

run()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
