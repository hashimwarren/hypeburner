import { expect, test, type Locator, type Page } from '@playwright/test'

test.use({ trace: 'retain-on-failure' })

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
          await expect(dialog.getByRole('navigation')).toBeVisible()
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
        await expect(
          page.getByRole('heading', { level: 1, name: 'All Posts', exact: true })
        ).toBeVisible()
        if (mobile) await expect(dialog.getByRole('navigation')).toBeHidden()
      })
    }
  })
}

async function expectVisuallyHiddenSkipLink(link: Locator) {
  // sr-only remains in the accessibility tree, so toBeHidden is not the right assertion.
  await expect(link).toHaveCSS('width', '1px')
  await expect(link).toHaveCSS('height', '1px')
  await expect(link).toHaveCSS('overflow', 'hidden')
  await expect(link).toHaveCSS('clip', 'rect(0px, 0px, 0px, 0px)')
}

for (const viewport of [
  { width: 375, height: 812 },
  { width: 1280, height: 900 },
]) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`Skip to content at ${viewport.width}px in ${theme}`, () => {
      test.use({ viewport, colorScheme: theme })

      for (const source of ['home', 'archive', 'article', 'contact'] as const) {
        test(`${source} bypasses the header using only the keyboard`, async ({
          page,
        }, testInfo) => {
          await page.addInitScript((theme) => localStorage.setItem('theme', theme), theme)
          let path: string
          if (source === 'article') {
            await page.goto('/blog')
            const article = page.locator('main article h2 a').first()
            await expect(
              article,
              'A published CMS article is required for skip-link coverage'
            ).toBeVisible()
            const articlePath = await article.getAttribute('href')
            if (!articlePath || !/^\/blog\/.+/.test(articlePath)) {
              throw new Error('The archive must expose a published article path')
            }
            path = articlePath
          } else {
            path = { home: '/', archive: '/blog', contact: '/contact' }[source]
          }
          testInfo.annotations.push({ type: 'route', description: path })
          // Fresh document navigation resets focus, including after article discovery.
          const response = await page.goto(path)
          expect(response?.ok(), 'The public route must load successfully').toBe(true)
          await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))

          const skip = page.getByRole('link', { name: 'Skip to content', exact: true })
          const main = page.locator('main#main-content')
          const home = page.locator('header').first().locator('a[href="/"]')
          await expect(skip).toHaveCount(1)
          await expect(skip).toHaveAttribute('href', '#main-content')
          await expect(page.getByRole('main')).toHaveCount(1)
          await expect(page.locator('#main-content')).toHaveCount(1)
          await expect(main).toHaveAttribute('tabindex', '-1')
          await expectVisuallyHiddenSkipLink(skip)

          await page.keyboard.press('Tab')
          await expect(skip).toBeFocused()
          await expect(skip).toHaveCSS('position', 'fixed')
          await expect(skip).toHaveCSS('clip', 'auto')
          await expect(skip).toHaveCSS('overflow', 'visible')
          await expect(skip).toHaveCSS('outline-style', 'solid')
          await expect(skip).toHaveCSS('outline-width', '2px')
          await expect(skip).toHaveCSS(
            'color',
            theme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)'
          )
          expect(await skip.evaluate((element) => getComputedStyle(element).outlineColor)).not.toBe(
            'rgba(0, 0, 0, 0)'
          )
          expect(
            await skip.evaluate((element) => {
              const style = getComputedStyle(element)
              return (
                style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                style.backgroundColor !== style.color
              )
            })
          ).toBe(true)
          await expectUnclipped(skip)
          expect(
            await skip.evaluate((element) => {
              const bounds = element.getBoundingClientRect()
              return [
                [bounds.left + 2, bounds.top + 2],
                [bounds.right - 2, bounds.top + 2],
                [bounds.left + 2, bounds.bottom - 2],
                [bounds.right - 2, bounds.bottom - 2],
                [bounds.left + bounds.width / 2, bounds.top + bounds.height / 2],
              ].every(([x, y]) => element.contains(document.elementFromPoint(x, y)))
            }),
            'The focused skip link must not be covered by the header or other content'
          ).toBe(true)
          await testInfo.attach(`${source}-${viewport.width}-${theme}-skip-focus`, {
            body: await page.screenshot(),
            contentType: 'image/png',
          })

          // Ignoring the skip link must still enter ordinary header navigation.
          await page.keyboard.press('Tab')
          await expect(home).toBeFocused()
          await expectVisuallyHiddenSkipLink(skip)
          await page.keyboard.press('Shift+Tab')
          await expect(skip).toBeFocused()
          await page.keyboard.press('Enter')
          await expect(main).toBeFocused()
          await expectVisuallyHiddenSkipLink(skip)

          const firstContentControl = main
            .locator(
              ':is(a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]):visible:not(:disabled):not([tabindex="-1"])'
            )
            .first()
          await expect(
            firstContentControl,
            'Main must contain a keyboard-accessible control'
          ).toBeVisible()
          await page.keyboard.press('Tab')
          await expect(firstContentControl).toBeFocused()
          expect(await main.evaluate((element) => element.contains(document.activeElement))).toBe(
            true
          )
          await expect(skip).not.toBeFocused()
        })
      }
    })
  }
}
