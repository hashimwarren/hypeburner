import { expect, test, type Locator, type Page } from '@playwright/test'

async function expectUnclipped(locator: Locator) {
  await expect(locator).toBeVisible()
  await expect
    .poll(
      () =>
        locator.evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          const outline = element.matches(':focus-visible')
            ? parseFloat(style.outlineWidth) + Math.max(0, parseFloat(style.outlineOffset))
            : 0
          if (
            bounds.left - outline < 0 ||
            bounds.top - outline < 0 ||
            bounds.right + outline > innerWidth ||
            bounds.bottom + outline > innerHeight
          ) {
            return false
          }
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const parentStyle = getComputedStyle(parent)
            const clip = parent.getBoundingClientRect()
            if (
              /(auto|scroll|hidden|clip)/.test(parentStyle.overflowX) &&
              (bounds.left - outline < clip.left || bounds.right + outline > clip.right)
            ) {
              return false
            }
            if (
              /(auto|scroll|hidden|clip)/.test(parentStyle.overflowY) &&
              (bounds.top - outline < clip.top || bounds.bottom + outline > clip.bottom)
            ) {
              return false
            }
          }
          return true
        }),
      {
        message:
          'The complete control and its focus outline must fit inside the viewport and clipping ancestors',
      }
    )
    .toBe(true)
}

async function tabTo(page: Page, target: Locator) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement)) break
  }
  await expect(target).toBeFocused()
}

for (const viewport of [
  { width: 375, height: 812 },
  { width: 640, height: 900 },
  { width: 1280, height: 900 },
]) {
  test.describe(`Blog navigation at ${viewport.width}px`, () => {
    test.use({ viewport })

    for (const source of ['homepage', 'article']) {
      test(`${source} opens the archive with visible keyboard focus`, async ({
        page,
      }, testInfo) => {
        if (source === 'article') {
          await page.goto('/blog')
          const article = page.locator('main article h2 a').first()
          await expect(
            article,
            'A published CMS article is required for article-header coverage'
          ).toBeVisible()
          const articlePath = await article.getAttribute('href')
          expect(articlePath).toMatch(/^\/blog\/.+/)
          await article.click()
          await expect(page).toHaveURL((url) => url.pathname === articlePath)
          await expect(page.locator('main h1')).toBeVisible()
        } else {
          await page.goto('/')
        }

        const header = page.locator('header').first()
        const home = header.locator('a[href="/"]')
        await expectUnclipped(home)
        await expectUnclipped(header.getByRole('button', { name: 'Search', exact: true }))
        await expectUnclipped(header.getByRole('button', { name: 'Theme switcher' }))
        await home.focus()

        const mobile = viewport.width < 640
        const dialog = page.getByRole('dialog')
        if (mobile) {
          const toggle = header.getByRole('button', { name: 'Toggle Menu' })
          await expectUnclipped(toggle)
          await tabTo(page, toggle)
          await page.keyboard.press('Enter')
          await expect(dialog).toBeVisible()
          await expect(dialog.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
            'href',
            '/'
          )
          await expectUnclipped(dialog.getByRole('link', { name: 'Home', exact: true }))
        }

        const navigation = mobile ? dialog : header
        const blog = navigation.getByRole('link', { name: 'Blog', exact: true })
        const work = navigation.getByRole('link', { name: 'Work With Me', exact: true })
        await expect(blog).toHaveCount(1)
        await expect(blog).toHaveAttribute('href', '/blog')
        await expect(work).toHaveAttribute('href', '/about')
        await expectUnclipped(blog)
        await expectUnclipped(work)
        if (!mobile) {
          expect(
            await blog.evaluate((element) => {
              const row = element.parentElement!
              return row.scrollWidth <= row.clientWidth
            }),
            'Desktop navigation must not require horizontal scrolling'
          ).toBe(true)
        }

        await tabTo(page, blog)
        await page.keyboard.press('Shift+Tab')
        await page.keyboard.press('Tab')
        await expect(blog).toBeFocused()
        await expect(blog).toHaveCSS('outline-style', 'solid')
        await expect(blog).toHaveCSS('outline-width', '2px')
        expect(await blog.evaluate((element) => getComputedStyle(element).outlineColor)).not.toBe(
          'rgba(0, 0, 0, 0)'
        )
        await expectUnclipped(blog)
        await testInfo.attach(`${source}-${viewport.width}-blog-focus`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        })

        await page.keyboard.press('Enter')
        await expect(page).toHaveURL((url) => url.pathname === '/blog')
        await expect(page.getByRole('heading', { name: 'All Posts', exact: true })).toBeVisible()
        if (mobile) await expect(dialog).toBeHidden()
      })
    }
  })
}
