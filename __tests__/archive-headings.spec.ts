import { expect, test } from '@playwright/test'

for (const width of [375, 639, 640, 1280]) {
  test.describe(`Archive headings at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    for (const archive of [
      { path: '/blog', title: 'All Posts', next: '/blog/page/2' },
      { path: '/blog/page/2', title: 'All Posts', previous: '/blog' },
      { path: '/tags/workos', title: 'Workos' },
      { path: '/tags/vercel/page/2', title: 'Vercel', previous: '/tags/vercel' },
    ]) {
      test(`${archive.path} exposes one descriptive H1 without clipping`, async ({
        page,
      }, testInfo) => {
        const response = await page.goto(archive.path)
        expect(response?.status(), 'The populated CMS archive must exist').toBe(200)

        const heading = page.getByRole('heading', { level: 1 })
        await expect(page.locator('h1')).toHaveCount(1)
        await expect(heading).toHaveCount(1)
        await expect(heading).toHaveText(archive.title)
        await expect(heading).toBeVisible()

        const article = page.locator('main article').first()
        await expect(article, 'Published CMS posts are required for archive coverage').toBeVisible()
        await expect(page.locator('main article h2 a').first()).toBeVisible()
        await page.evaluate(() => document.fonts.ready)

        await testInfo.attach(`archive-${width}-${archive.path.replaceAll('/', '-')}`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        })

        const headingBounds = await heading.boundingBox()
        const articleBounds = await article.boundingBox()
        expect(headingBounds).not.toBeNull()
        expect(articleBounds).not.toBeNull()
        expect(headingBounds!.x).toBeGreaterThanOrEqual(0)
        expect(headingBounds!.y).toBeGreaterThanOrEqual(0)
        expect(headingBounds!.x + headingBounds!.width).toBeLessThanOrEqual(width)
        expect(headingBounds!.y + headingBounds!.height).toBeLessThanOrEqual(900)
        expect(headingBounds!.y + headingBounds!.height).toBeLessThanOrEqual(articleBounds!.y)
        expect(
          await heading.evaluate((element) => {
            const bounds = element.getBoundingClientRect()
            for (let parent = element.parentElement; parent; parent = parent.parentElement) {
              const style = getComputedStyle(parent)
              const clip = parent.getBoundingClientRect()
              if (
                /(auto|scroll|hidden|clip)/.test(style.overflowX) &&
                (bounds.left < clip.left || bounds.right > clip.right)
              ) {
                return false
              }
              if (
                /(auto|scroll|hidden|clip)/.test(style.overflowY) &&
                (bounds.top < clip.top || bounds.bottom > clip.bottom)
              ) {
                return false
              }
            }
            return (
              element.scrollWidth <= element.clientWidth &&
              element.scrollHeight <= element.clientHeight
            )
          }),
          'The complete heading must fit within its box and clipping ancestors'
        ).toBe(true)

        const sidebar = page.locator('main .max-h-screen')
        if (width >= 640) {
          await expect(sidebar).toBeVisible()
          const sidebarBounds = await sidebar.boundingBox()
          expect(sidebarBounds).not.toBeNull()
          expect(headingBounds!.y + headingBounds!.height).toBeLessThanOrEqual(sidebarBounds!.y)
          expect(sidebarBounds!.x + sidebarBounds!.width).toBeLessThanOrEqual(articleBounds!.x)
        } else {
          await expect(sidebar).toBeHidden()
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          'Archive content must not require horizontal scrolling'
        ).toBe(true)

        const destination = archive.previous || archive.next
        if (destination) {
          const pagination = page.getByRole('link', {
            name: archive.previous ? 'Previous' : 'Next',
            exact: true,
          })
          await expect(pagination).toBeVisible()
          await pagination.click()
          await expect(page).toHaveURL((url) => url.pathname.replace(/\/$/, '') === destination)
          await expect(page.getByRole('heading', { level: 1 })).toHaveText(archive.title)
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        }
      })
    }
  })
}
