import { expect, test, type Locator, type Page } from '@playwright/test'
import siteMetadata from '../data/siteMetadata'
import { createCopyLayoutHarness, fixtureArticlePath } from './fixtures/article-copy-harness'

const articlePath = '/blog/2026-05-25'
const canonicalUrl = `${new URL(siteMetadata.siteUrl).origin}${articlePath}`
const browsingPath = `${articlePath}?utm_source=copy-test#copy-test`
type ClipboardMode = 'success' | 'rejected' | 'unavailable' | 'missing-method' | 'throws'
let fixtureHarness: ReturnType<typeof createCopyLayoutHarness> | undefined

test.afterAll(async () => {
  if (fixtureHarness) (await fixtureHarness).dispose()
})

// These shims exercise failure/retry deterministically; the separate round-trip test uses Chromium.
async function simulateClipboard(page: Page, mode: ClipboardMode) {
  await page.evaluate((mode) => {
    let copied = ''
    const clipboard: Partial<Pick<Clipboard, 'writeText' | 'readText'>> = {
      readText: async () => copied,
    }
    if (mode !== 'missing-method') {
      clipboard.writeText = (value) => {
        if (mode === 'throws') throw new Error('Simulated synchronous clipboard failure')
        if (mode === 'rejected') return Promise.reject(new Error('Simulated permission denial'))
        copied = value
        return Promise.resolve()
      }
    }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: mode === 'unavailable' ? undefined : clipboard,
    })
  }, mode)
}

async function openArticle(page: Page) {
  const response = await page.goto(browsingPath)
  expect(response?.status()).toBe(200)
  const article = page.locator('article')
  await expect(article.locator('.prose')).toContainText(/\S/)
  // This existing action identifies the real PostLayout route, not a test-only fixture.
  await expect(article.getByRole('link', { name: 'Discuss on Twitter' })).toBeVisible()
  const button = article.getByRole('button', { name: 'Copy article link', exact: true })
  await expect(button).toHaveCount(1)
  const group = button.locator('..')
  const status = group.getByRole('status')
  await expect(status).toHaveAttribute('aria-atomic', 'true')
  await expect(status).toBeEmpty()
  await page.evaluate(() => document.fonts.ready)
  return { article, button, group, status }
}

async function geometry(control: Locator) {
  await control.evaluate((element) =>
    element.scrollIntoView({ block: 'center', behavior: 'instant' })
  )
  return control.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const floating = document.querySelector('[data-article-scroll-controls]')
    const others = floating ? Array.from(floating.querySelectorAll('button')) : []
    const collisions = others
      .filter((other) => {
        const box = other.getBoundingClientRect()
        return (
          box.width > 0 &&
          box.height > 0 &&
          Math.min(rect.right, box.right) - Math.max(rect.left, box.left) > 1 &&
          Math.min(rect.bottom, box.bottom) - Math.max(rect.top, box.top) > 1
        )
      })
      .map((other) => other.getAttribute('aria-label'))
    const group = element.closest('div.flex.flex-col') || element.parentElement!
    const groupBounds = group.getBoundingClientRect()
    const walker = document.createTreeWalker(group, NodeFilter.SHOW_TEXT)
    const textBounds: DOMRect[] = []
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent?.trim()) continue
      // Textarea scrolling/selection is checked separately; DOM Range does not model its wrapping.
      if (walker.currentNode.parentElement?.closest('textarea')) continue
      const range = document.createRange()
      range.selectNodeContents(walker.currentNode)
      textBounds.push(...Array.from(range.getClientRects()))
    }
    return {
      rect: rect.toJSON(),
      group: groupBounds.toJSON(),
      collisions,
      overflow: document.documentElement.scrollWidth > innerWidth,
      textClipped: textBounds.some(
        (box) =>
          box.left < Math.max(0, groupBounds.left) - 1 ||
          box.right > Math.min(innerWidth, groupBounds.right) + 1
      ),
      hit: element.contains(
        document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      ),
      inViewport:
        rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
    }
  })
}

function expectUsable(measurement: Awaited<ReturnType<typeof geometry>>) {
  expect(measurement.overflow).toBe(false)
  expect(measurement.textClipped).toBe(false)
  expect(measurement.collisions).toEqual([])
  expect(measurement.hit).toBe(true)
  expect(measurement.inViewport).toBe(true)
  expect(measurement.rect.width).toBeGreaterThanOrEqual(44)
  expect(measurement.rect.height).toBeGreaterThanOrEqual(44)
}

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 375, 1280]) {
    test.describe(`copy article at ${width}px in ${theme}`, () => {
      test.use({ viewport: { width, height: 900 }, hasTouch: width < 768, colorScheme: theme })

      for (const layout of ['PostSimple', 'PostBanner'] as const) {
        test(`${layout} fixture wraps long URLs with production CSS and real hydration`, async ({
          page,
        }, testInfo) => {
          await openArticle(page)
          const stylesheets = await page
            .locator('link[rel="stylesheet"]')
            .evaluateAll((links) =>
              links
                .map((link) => (link instanceof HTMLLinkElement ? link.href : ''))
                .filter(Boolean)
            )
          expect(stylesheets.length).toBeGreaterThan(0)
          fixtureHarness ??= createCopyLayoutHarness()
          const harness = await fixtureHarness
          const fixtureUrl = `/__article-copy-layout-fixture__/${layout}`
          const errors: string[] = []
          page.on('pageerror', (error) => errors.push(error.message))
          await page.route(`**${fixtureUrl}`, (route) =>
            route.fulfill({
              contentType: 'text/html',
              body: harness.html(layout, theme, stylesheets),
            })
          )
          const response = await page.goto(fixtureUrl)
          expect(response?.status()).toBe(200)
          await expect(page.locator('body')).toHaveAttribute('data-hydrated', 'true')
          await page.evaluate(() => document.fonts.ready)
          const button = page.getByRole('button', { name: 'Copy article link', exact: true })
          await expect(button).toHaveCount(1)
          const group = button.locator('..')
          const status = group.getByRole('status')
          const expectedUrl = `${new URL(siteMetadata.siteUrl).origin}/${fixtureArticlePath}`
          await simulateClipboard(page, 'success')
          const buttonGeometry = await geometry(button)
          expectUsable(buttonGeometry)
          if (width < 768) await button.tap()
          else await button.press('Enter')
          await expect(status).toHaveText('Article link copied.')
          expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expectedUrl)
          await simulateClipboard(page, 'unavailable')
          await button.press('Space')
          const fallback = group.getByRole('textbox', { name: 'Article link', exact: true })
          await expect(fallback).toBeFocused()
          await expect(fallback).toHaveValue(expectedUrl)
          const fallbackGeometry = await geometry(fallback)
          expectUsable(fallbackGeometry)
          expect(
            await fallback.evaluate((element) =>
              element instanceof HTMLTextAreaElement
                ? [element.selectionStart, element.selectionEnd]
                : null
            )
          ).toEqual([0, expectedUrl.length])
          await expect(
            page.getByRole('button', { name: 'Scroll To Top', exact: true })
          ).toBeVisible()
          await testInfo.attach(`${layout}-manual-fallback`, {
            body: await page.screenshot(),
            contentType: 'image/png',
          })
          await page.keyboard.press('Shift+Tab')
          await expect(button).toBeFocused()
          await simulateClipboard(page, 'success')
          await page.keyboard.press('Enter')
          await expect(fallback).toHaveCount(0)
          await expect(status).toHaveText('Article link copied again (2).')
          await expect(page.getByRole('link', { name: /Previous article/ })).toHaveAttribute(
            'href',
            '/blog/previous'
          )
          await expect(page.getByRole('link', { name: /Next article/ })).toHaveAttribute(
            'href',
            '/blog/next'
          )
          expect(errors).toEqual([])
          await testInfo.attach('alternate-layout-fixture-evidence', {
            body: JSON.stringify({
              layout,
              width,
              theme,
              stylesheetUrls: stylesheets,
              expectedUrl,
              buttonGeometry,
              fallbackGeometry,
              coverage:
                'actual layout SSR and hydration with explicit fixture data; not a live CMS article',
              clipboard: 'simulated',
            }),
            contentType: 'application/json',
          })
        })
      }

      test('success, repeated announcements and manual fallback remain usable', async ({
        page,
      }, testInfo) => {
        await page.addInitScript((theme) => localStorage.setItem('theme', theme), theme)
        const { button, group, status } = await openArticle(page)
        await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))
        const originalLocation = page.url()
        await simulateClipboard(page, 'success')
        await button.scrollIntoViewIfNeeded()
        if (width < 768) await button.tap()
        else {
          await button.focus()
          await page.keyboard.press('Enter')
        }
        await expect(status).toHaveText('Article link copied.')
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(canonicalUrl)
        const statuses = [await status.innerText()]
        await button.focus()
        await page.keyboard.press('Tab')
        await expect(button).not.toBeFocused()
        await page.keyboard.press('Shift+Tab')
        await expect(button).toBeFocused()
        const focus = await button.evaluate((element) => {
          const style = getComputedStyle(element)
          return {
            visible: element.matches(':focus-visible'),
            outline: style.outlineStyle,
            width: parseFloat(style.outlineWidth),
            offset: parseFloat(style.outlineOffset),
          }
        })
        expect(focus).toMatchObject({ visible: true, outline: 'solid' })
        expect(focus.width).toBeGreaterThanOrEqual(2)
        expect(focus.offset).toBeGreaterThanOrEqual(2)
        await page.keyboard.press('Space')
        await expect(status).toHaveText('Article link copied again (2).')
        statuses.push(await status.innerText())
        await expect(button).toHaveAccessibleName('Copy article link')
        const buttonGeometry = await geometry(button)
        expectUsable(buttonGeometry)
        await testInfo.attach('copy-success', {
          body: await page.screenshot(),
          contentType: 'image/png',
        })

        await simulateClipboard(page, 'rejected')
        if (width < 768) await button.tap()
        else await button.press('Enter')
        const fallback = group.getByRole('textbox', { name: 'Article link', exact: true })
        await expect(fallback).toBeFocused()
        await expect(fallback).toHaveValue(canonicalUrl)
        await expect(fallback).toHaveAttribute('readonly', '')
        await expect(fallback).toHaveAccessibleDescription(/Copy this link manually/)
        expect(
          await fallback.evaluate((element) =>
            element instanceof HTMLTextAreaElement
              ? [element.selectionStart, element.selectionEnd]
              : null
          )
        ).toEqual([0, canonicalUrl.length])
        await expect(status).toHaveText(
          'Could not copy the article link. Copy it manually below, or try again.'
        )
        statuses.push(await status.innerText())
        const fallbackGeometry = await geometry(fallback)
        expectUsable(fallbackGeometry)
        await expect(page.getByRole('button', { name: 'Scroll To Top', exact: true })).toBeVisible()
        await testInfo.attach('copy-manual-fallback', {
          body: await page.screenshot(),
          contentType: 'image/png',
        })
        await page.keyboard.press('Tab')
        await expect(fallback).not.toBeFocused()
        await page.keyboard.press('Shift+Tab')
        await expect(fallback).toBeFocused()
        await page.keyboard.press('Shift+Tab')
        await expect(button).toBeFocused()
        await simulateClipboard(page, 'success')
        await page.keyboard.press('Enter')
        await expect(fallback).toHaveCount(0)
        await expect(status).toHaveText('Article link copied again (3).')
        statuses.push(await status.innerText())
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(canonicalUrl)
        expect(page.url()).toBe(originalLocation)
        await testInfo.attach('copy-evidence', {
          body: JSON.stringify({
            articlePath,
            layout: 'PostLayout',
            canonicalUrl,
            originalLocation,
            width,
            theme,
            clipboard: 'simulated',
            statuses,
            focus,
            buttonGeometry,
            fallbackGeometry,
            screenReaderSpeech: 'not tested',
          }),
          contentType: 'application/json',
        })
      })
    })
  }
}

for (const mode of ['unavailable', 'missing-method', 'throws', 'rejected'] as const) {
  test(`clipboard ${mode} exposes the exact selectable URL and permits retry`, async ({ page }) => {
    const { button, group, status } = await openArticle(page)
    await simulateClipboard(page, mode)
    await button.click()
    const fallback = group.getByRole('textbox', { name: 'Article link', exact: true })
    await expect(fallback).toBeFocused()
    await expect(fallback).toHaveValue(canonicalUrl)
    await expect(status).toContainText('Could not copy')
    const firstFailure = await status.innerText()
    await page.keyboard.press('Shift+Tab')
    await expect(button).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(status).toContainText('Could not copy the article link again (2).')
    expect(await status.innerText()).not.toBe(firstFailure)
    await expect(fallback).toBeFocused()
    await simulateClipboard(page, 'success')
    await page.keyboard.press('Shift+Tab')
    await expect(button).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(status).toHaveText('Article link copied.')
    await expect(fallback).toHaveCount(0)
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(canonicalUrl)
  })
}

test('real Chromium clipboard round trip copies the canonical public URL', async ({
  page,
  context,
}, testInfo) => {
  const { button, status } = await openArticle(page)
  const originalLocation = page.url()
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(page.url()).origin,
  })
  try {
    await button.click()
    await expect(status).toHaveText('Article link copied.')
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toBe(canonicalUrl)
    await button.press('Enter')
    await expect(status).toHaveText('Article link copied again (2).')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(canonicalUrl)
    expect(page.url()).toBe(originalLocation)
    await testInfo.attach('real-clipboard-round-trip', {
      body: JSON.stringify({
        articlePath,
        originalLocation,
        copied,
        clipboard: 'real Chromium API with granted permissions',
      }),
      contentType: 'application/json',
    })
  } finally {
    await context.clearPermissions()
  }
})
