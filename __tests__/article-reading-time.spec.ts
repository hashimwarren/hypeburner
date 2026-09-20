import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const articlePath = '/blog/2026-05-25'

type BundleNode = { label: string; path?: string; groups?: BundleNode[] }

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 375, 1280]) {
    test(`article reading time at ${width}px in ${theme} mode`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme: theme })
      await page.addInitScript((theme) => localStorage.setItem('theme', theme), theme)
      const loadedScriptUrls = new Set<string>()
      // Track completed requests, not script tags that this browser may never load (e.g. noModule).
      page.on('requestfinished', (request) => {
        const url = new URL(request.url())
        if (url.pathname.startsWith('/_next/') && url.pathname.endsWith('.js')) {
          loadedScriptUrls.add(request.url())
        }
      })
      const response = await page.goto(articlePath)
      expect(response?.status()).toBe(200)
      const article = page.locator('article')
      const label = article.locator('[data-reading-time]')
      await expect(article).toBeVisible()
      await expect(article.locator('.prose')).toContainText(/\S/)
      await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))
      await expect(label).toHaveCount(1)
      await expect(label).toBeVisible()
      await expect(label).toHaveText(/^[1-9]\d* min read$/)
      await expect(article.locator('header time')).toBeVisible()
      await expect(article.locator('h1')).toBeVisible()
      await page.evaluate(() => document.fonts.ready)

      const geometry = await label.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        const header = element.closest('header')!
        const bounds = header.getBoundingClientRect()
        const overlaps = Array.from(header.querySelectorAll('time, h1'))
          .filter((other) => {
            const box = other.getBoundingClientRect()
            return (
              Math.min(rect.right, box.right) - Math.max(rect.left, box.left) > 1 &&
              Math.min(rect.bottom, box.bottom) - Math.max(rect.top, box.top) > 1
            )
          })
          .map((other) => other.tagName)
        return {
          label: rect.toJSON(),
          header: bounds.toJSON(),
          overlaps,
          color: getComputedStyle(element).color,
          overflow: document.documentElement.scrollWidth > innerWidth,
        }
      })
      expect(geometry.overlaps).toEqual([])
      expect(geometry.overflow).toBe(false)
      expect(geometry.label.left).toBeGreaterThanOrEqual(geometry.header.left - 1)
      expect(geometry.label.right).toBeLessThanOrEqual(geometry.header.right + 1)
      expect(geometry.label.left).toBeGreaterThanOrEqual(0)
      expect(geometry.label.right).toBeLessThanOrEqual(width)
      await testInfo.attach('reading-time-metadata', {
        body: JSON.stringify({
          articlePath,
          width,
          theme,
          geometry,
          label: await label.innerText(),
          proseSHA256: createHash('sha256')
            .update(await article.locator('.prose').innerHTML())
            .digest('hex'),
        }),
        contentType: 'application/json',
      })
      await testInfo.attach('reading-time-header', {
        body: await page.screenshot(),
        contentType: 'image/png',
      })

      // Confirm the existing mobile clearance and floating control remain intact.
      const top = page.getByRole('button', { name: 'Scroll To Top', includeHidden: true })
      await page.evaluate(() => window.scrollTo({ top: 51, behavior: 'instant' }))
      await expect(top).toBeVisible()
      await expect(article).toHaveCSS('padding-right', width < 768 ? '36px' : '0px')
      const labelBox = await label.boundingBox()
      const topBox = await top.boundingBox()
      expect(labelBox).not.toBeNull()
      expect(topBox).not.toBeNull()
      expect(
        Math.min(labelBox!.x + labelBox!.width, topBox!.x + topBox!.width) -
          Math.max(labelBox!.x, topBox!.x) <=
          1 ||
          Math.min(labelBox!.y + labelBox!.height, topBox!.y + topBox!.height) -
            Math.max(labelBox!.y, topBox!.y) <=
            1
      ).toBe(true)

      if (width === 1280 && theme === 'light') {
        // Inspect module identities from the existing production bundle analyzer, not minified names.
        const report = readFileSync('.next/analyze/client.html', 'utf8')
        const chartData = report.match(/window\.chartData = (.*);/)
        expect(chartData, 'CI must build with ANALYZE=true').not.toBeNull()
        const chunks: BundleNode[] = JSON.parse(chartData![1])
        const loadedChunks = Array.from(
          new Set(
            Array.from(loadedScriptUrls, (url) =>
              decodeURIComponent(new URL(url).pathname.slice('/_next/'.length))
            )
          )
        )
        const matched = chunks.filter((chunk) => loadedChunks.includes(chunk.label))
        await testInfo.attach('article-client-chunk-accounting', {
          body: JSON.stringify({
            requestedUrls: [...loadedScriptUrls],
            loadedChunks,
            matchedChunks: matched.map((chunk) => chunk.label),
          }),
          contentType: 'application/json',
        })
        expect(loadedChunks.length).toBeGreaterThan(0)
        expect(matched.map((chunk) => chunk.label).sort()).toEqual([...loadedChunks].sort())
        const modules: string[] = []
        const visit = (node: BundleNode) => {
          if (node.path) modules.push(node.path)
          node.groups?.forEach(visit)
        }
        matched.forEach(visit)
        expect(modules.length).toBeGreaterThan(0)
        const forbidden = modules.filter((name) =>
          /(?:node_modules\/reading-time(?:\/|$)|node_modules\/payload(?:\/|$)|payload\.config\.|lib\/cms\/(?:index|reading-time|env|artifacts)\.)/.test(
            name
          )
        )
        await testInfo.attach('article-client-module-boundary', {
          body: JSON.stringify({ chunks: matched.map((chunk) => chunk.label), modules, forbidden }),
          contentType: 'application/json',
        })
        expect(forbidden).toEqual([])
      }
    })
  }
}
