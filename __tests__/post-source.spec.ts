import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import siteMetadata from '../data/siteMetadata'

const articles = [
  { slug: '2026-05-25', legacySourcePath: null },
  { slug: 'news/zed-deltadb', legacySourcePath: 'data/blog/news/zed-deltadb.mdx' },
]

for (const width of [375, 1280]) {
  for (const article of articles) {
    test(`${article.slug} source provenance at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      const path = `/blog/${article.slug}`
      const sourceUrl = article.legacySourcePath
        ? `${siteMetadata.siteRepo}/blob/main/${article.legacySourcePath}`
        : null
      const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
        timeout: 5000,
      }).trim()

      // Read the candidate's real published content; do not substitute fixtures or intercept requests.
      const metadataResponse = await page.request.get('/api/posts', {
        params: {
          limit: '1',
          depth: '0',
          'select[slug]': 'true',
          'select[status]': 'true',
          'select[layout]': 'true',
          'select[legacySourcePath]': 'true',
          'where[slug][equals]': article.slug,
        },
      })
      expect(metadataResponse.status()).toBe(200)
      const metadata = await metadataResponse.json()
      await testInfo.attach('candidate-content', {
        body: JSON.stringify({ checkoutSha, path, width, metadata }, null, 2),
        contentType: 'application/json',
      })
      expect(metadata.docs).toHaveLength(1)
      expect(metadata.docs[0]).toMatchObject({
        ...article,
        status: 'published',
        layout: 'PostLayout',
      })

      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
      const post = page.locator('article')
      await expect(post).toBeVisible()
      await expect(post.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(post.locator('.prose')).not.toBeEmpty()
      const discuss = post.getByRole('link', { name: 'Discuss on Twitter', exact: true })
      await expect(discuss).toHaveAttribute(
        'href',
        `https://mobile.twitter.com/search?q=${encodeURIComponent(`${siteMetadata.siteUrl}${path}`)}`
      )
      await expect(discuss).toHaveAttribute('rel', 'nofollow')
      const sourceRow = discuss.locator('..')
      const source = page.getByRole('link', { name: 'View on GitHub', exact: true })
      if (sourceUrl) {
        await expect(source).toHaveCount(1)
        await expect(source).toHaveAttribute('href', sourceUrl)
        await expect(source).toHaveAttribute('target', '_blank')
        await expect(source).toHaveAttribute('rel', 'noopener noreferrer')
        await expect(sourceRow).toHaveText('Discuss on Twitter • View on GitHub')
      } else {
        await expect(source).toHaveCount(0)
        await expect(sourceRow).toHaveText('Discuss on Twitter')
      }
      await expect(post.getByRole('link', { name: 'Back to the blog' })).toHaveAttribute(
        'href',
        '/blog'
      )
      const footer = page.getByRole('contentinfo')
      await expect(footer).toHaveCount(1)
      await expect(footer.getByRole('link', { name: 'RSS', exact: true })).toHaveAttribute(
        'href',
        '/feed.xml'
      )

      await sourceRow.scrollIntoViewIfNeeded()
      await testInfo.attach('source-row', {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      await testInfo.attach('candidate-dom', {
        body: JSON.stringify(
          {
            checkoutSha,
            url: page.url(),
            width,
            sourceUrl,
            sourceRow: await sourceRow.evaluate((element) => element.outerHTML),
            article: await post.evaluate((element) => element.outerHTML),
            footer: await footer.evaluate((element) => element.outerHTML),
          },
          null,
          2
        ),
        contentType: 'application/json',
      })
      if (sourceUrl) {
        const target = await page.request.get(sourceUrl)
        await testInfo.attach('legacy-source-target', {
          body: JSON.stringify({ checkoutSha, url: target.url(), status: target.status() }),
          contentType: 'application/json',
        })
        expect(target.status()).toBe(200)
      }
    })
  }
}
