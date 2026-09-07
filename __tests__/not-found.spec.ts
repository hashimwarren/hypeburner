import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'

test.use({ trace: 'retain-on-failure' })

async function expectRecovery(page: Page) {
  await expect(page.locator('html')).toHaveCount(1)
  await expect(page.locator('body')).toHaveCount(1)
  await expect(page.getByRole('main')).toHaveCount(1)
  await expect(page.locator('header').first()).toBeVisible()
  await expect(page.getByRole('contentinfo')).toBeVisible()
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1, name: '404', exact: true })).toBeVisible()
  for (const [name, href] of [
    ['Browse blog', '/blog'],
    ['Home', '/'],
  ]) {
    const link = main.getByRole('link', { name, exact: true })
    await expect(link).toHaveCount(1)
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', href)
  }
}

async function tabTo(page: Page, target: Locator) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) break
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
}

async function expectFocusUnclipped(link: Locator) {
  await expect(link).toBeFocused()
  await expect(link).toHaveCSS('outline-style', 'solid')
  await expect(link).toHaveCSS('outline-width', '2px')
  expect(await link.evaluate((element) => getComputedStyle(element).outlineColor)).not.toBe(
    'rgba(0, 0, 0, 0)'
  )
  expect(
    await link.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const outline = parseFloat(style.outlineWidth) + Math.max(0, parseFloat(style.outlineOffset))
      if (
        bounds.left - outline < 0 ||
        bounds.top - outline < 0 ||
        bounds.right + outline > innerWidth ||
        bounds.bottom + outline > innerHeight
      )
        return false
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent)
        const clip = parent.getBoundingClientRect()
        if (
          /(auto|scroll|hidden|clip)/.test(style.overflowX) &&
          (bounds.left - outline < clip.left || bounds.right + outline > clip.right)
        )
          return false
        if (
          /(auto|scroll|hidden|clip)/.test(style.overflowY) &&
          (bounds.top - outline < clip.top || bounds.bottom + outline > clip.bottom)
        )
          return false
      }
      return true
    }),
    'The entire recovery control and focus outline must be unclipped'
  ).toBe(true)
}

for (const width of [320, 375, 1280]) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`Missing-page recovery at ${width}px in ${theme}`, () => {
      test.use({ viewport: { width, height: 900 }, colorScheme: theme })

      for (const prefix of ['', '/blog']) {
        test(`${prefix || 'public'} missing URL keeps 404 and offers keyboard recovery`, async ({
          page,
          request,
        }, testInfo) => {
          await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
          const path = `${prefix}/missing-${randomUUID()}`
          expect((await page.goto(path))?.status()).toBe(404)
          await expect(page).toHaveURL((url) => url.pathname === path)
          await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))
          await expectRecovery(page)
          expect((await page.reload())?.status()).toBe(404)
          await expectRecovery(page)
          const response = await request.get(path, { maxRedirects: 0 })
          expect(response.status()).toBe(404)
          expect(response.headers()['x-content-type-options']).toBe('nosniff')
          expect(response.headers()['x-frame-options']).toBe('DENY')
          expect(response.headers()['content-security-policy']).toContain("default-src 'self'")
          expect(response.headers()['strict-transport-security']).toBe(
            'max-age=31536000; includeSubDomains'
          )
          expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin')

          const main = page.getByRole('main')
          const blog = main.getByRole('link', { name: 'Browse blog', exact: true })
          const home = main.getByRole('link', { name: 'Home', exact: true })
          await tabTo(page, blog)
          await expectFocusUnclipped(blog)
          await page.keyboard.press('Tab')
          await expectFocusUnclipped(home)
          await page.keyboard.press('Shift+Tab')
          await expectFocusUnclipped(blog)
          const blogBounds = await blog.boundingBox()
          const homeBounds = await home.boundingBox()
          expect(blogBounds).not.toBeNull()
          expect(homeBounds).not.toBeNull()
          expect(
            blogBounds!.x + blogBounds!.width <= homeBounds!.x ||
              blogBounds!.y + blogBounds!.height <= homeBounds!.y
          ).toBe(true)
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
          ).toBe(true)
          await testInfo.attach('recovery-focus-and-wrapping', {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png',
          })

          for (const [name, destination] of [
            ['Browse blog', '/blog'],
            ['Home', '/'],
          ]) {
            if (destination === '/') {
              expect((await page.goto(path))?.status()).toBe(404)
              await expectRecovery(page)
            }
            await tabTo(page, main.getByRole('link', { name, exact: true }))
            await page.keyboard.press('Enter')
            await expect(page).toHaveURL((url) => url.pathname === destination)
            if (destination === '/blog') {
              await expect(
                page.getByRole('heading', { level: 1, name: 'All Posts', exact: true })
              ).toBeVisible()
            } else {
              await expect(page.locator('main h1')).toBeVisible()
              await expect(page.getByRole('heading', { name: '404', exact: true })).toHaveCount(0)
            }
            expect((await request.get(destination, { maxRedirects: 0 })).status()).toBe(200)
            await page.goBack()
            await expect(page).toHaveURL((url) => url.pathname === path)
            await expectRecovery(page)
          }
          await testInfo.attach('http-recovery-evidence', {
            body: Buffer.from(
              JSON.stringify({
                path,
                status: response.status(),
                destinations: ['/blog', '/'],
                width,
                theme,
              })
            ),
            contentType: 'application/json',
          })
        })
      }
    })
  }
}

for (const prefix of ['', '/blog']) {
  test(`nested ${prefix || 'public'} missing path returns visible recovery with 404`, async ({
    page,
    request,
  }) => {
    const path = `${prefix}/missing-${randomUUID()}/nested`
    expect((await page.goto(path))?.status()).toBe(404)
    await expect(page).toHaveURL((url) => url.pathname === path)
    await expectRecovery(page)
    expect((await request.get(path, { maxRedirects: 0 })).status()).toBe(404)
    expect((await page.reload())?.status()).toBe(404)
    await expectRecovery(page)
  })
}

test('public routes and a real published article retain successful responses', async ({
  page,
  request,
}, testInfo) => {
  for (const path of ['/', '/blog', '/about', '/contact', '/projects', '/tags']) {
    expect((await page.goto(path))?.status(), path).toBe(200)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.getByRole('heading', { name: '404', exact: true })).toHaveCount(0)
  }
  await page.goto('/blog')
  const articles = page.locator('main article h2 a')
  await expect(articles.first(), 'A real published CMS article is required').toBeVisible()
  const published = await articles.evaluateAll((links) =>
    links.map((link) => ({
      path: link.getAttribute('href')!,
      title: link.textContent!.trim(),
    }))
  )
  const article = published[0]
  expect(article.path).toMatch(/^\/blog\/.+/)
  expect((await page.goto(article.path))?.status()).toBe(200)
  await expect(
    page.getByRole('heading', { level: 1, name: article.title, exact: true })
  ).toBeVisible()
  expect((await request.get(article.path, { maxRedirects: 0 })).status()).toBe(200)

  const manifest = JSON.parse(await readFile('.next/prerender-manifest.json', 'utf8'))
  const postBuildArticle = published.find(({ path }) => !(path in manifest.routes))
  if (postBuildArticle) {
    expect((await page.goto(postBuildArticle.path))?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { level: 1, name: postBuildArticle.title, exact: true })
    ).toBeVisible()
    expect((await request.get(postBuildArticle.path, { maxRedirects: 0 })).status()).toBe(200)
  } else {
    const description =
      'Post-build valid slug runtime coverage unavailable: all articles discovered on the public archive are already prerendered. No CMS content was created or modified.'
    testInfo.annotations.push({ type: 'coverage-gap', description })
    await testInfo.attach('post-build-slug-coverage', {
      body: Buffer.from(description),
      contentType: 'text/plain',
    })
  }
})

for (const path of ['/cms', '/cms/login', '/cms/missing-recovery/nested']) {
  test(`${path} remains owned by Payload for an unauthenticated visitor`, async ({ page }) => {
    await page.goto(path)
    await expect(page).toHaveURL((url) => url.pathname === '/cms/login')
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Browse blog', exact: true })).toHaveCount(0)
  })
}

test('unknown API and unauthenticated current-user requests remain JSON endpoints', async ({
  request,
}) => {
  const missing = await request.get(`/api/missing-${randomUUID()}/nested`, { maxRedirects: 0 })
  expect(missing.status()).toBe(404)
  expect(missing.headers()['content-type']).toContain('application/json')
  expect(await missing.json()).toHaveProperty('errors')
  const me = await request.get('/api/users/me', { maxRedirects: 0 })
  expect(me.status()).toBe(200)
  expect(me.headers()['content-type']).toContain('application/json')
  expect(await me.json()).toHaveProperty('user', null)
})
