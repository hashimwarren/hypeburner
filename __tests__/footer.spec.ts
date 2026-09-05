import { expect, test } from '@playwright/test'

test.use({ baseURL: process.env.RSS_TEST_BASE_URL || 'http://localhost:3000' })

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1280, 375, 320]) {
    for (const path of ['/', '/contact']) {
      test(`${path} RSS footer at ${width}px in ${theme} mode`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 })
        await page.emulateMedia({ colorScheme: theme })
        await page.addInitScript((theme) => localStorage.setItem('theme', theme), theme)
        const response = await page.goto(path)
        expect(response?.status()).toBe(200)
        await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))

        const footer = page.getByRole('contentinfo')
        const rss = footer.getByRole('link', { name: 'RSS', exact: true })
        const home = footer.getByRole('link', { name: 'Hypeburner', exact: true })
        await expect(rss).toHaveCount(1)
        await expect(rss).toBeVisible()
        await expect(rss).toHaveAttribute('href', '/feed.xml')
        await expect(rss).not.toHaveAttribute('target')
        await expect(rss).not.toHaveAttribute('download')
        await rss.scrollIntoViewIfNeeded()
        await testInfo.attach('footer', {
          body: await footer.screenshot(),
          contentType: 'image/png',
        })

        // Start at the preceding footer link, then use real keyboard navigation.
        await home.focus()
        await page.keyboard.press('Tab')
        await expect(rss).toBeFocused()
        await page.keyboard.press('Shift+Tab')
        await expect(home).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(rss).toBeFocused()

        const appearance = await rss.evaluate((link) => {
          const style = getComputedStyle(link)
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = 1
          const context = canvas.getContext('2d')!
          const ancestors: Element[] = []
          for (let node: Element | null = link; node; node = node.parentElement)
            ancestors.unshift(node)
          context.fillStyle = '#fff'
          context.fillRect(0, 0, 1, 1)
          for (const ancestor of ancestors) {
            context.fillStyle = getComputedStyle(ancestor).backgroundColor
            context.fillRect(0, 0, 1, 1)
          }
          const luminance = (rgb: Uint8ClampedArray) => {
            const [r, g, b] = Array.from(rgb).map((value) => {
              const channel = value / 255
              return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
            })
            return 0.2126 * r + 0.7152 * g + 0.0722 * b
          }
          const background = context.getImageData(0, 0, 1, 1)
          const backgroundLuminance = luminance(background.data)
          const contrast = (color: string) => {
            context.putImageData(background, 0, 0)
            context.fillStyle = color
            context.fillRect(0, 0, 1, 1)
            const foreground = luminance(context.getImageData(0, 0, 1, 1).data)
            return (
              (Math.max(foreground, backgroundLuminance) + 0.05) /
              (Math.min(foreground, backgroundLuminance) + 0.05)
            )
          }
          return {
            textContrast: contrast(style.color),
            focusContrast: contrast(style.outlineColor),
            outlineStyle: style.outlineStyle,
            outlineWidth: parseFloat(style.outlineWidth),
            outlineOffset: parseFloat(style.outlineOffset),
            underline: style.textDecorationLine,
            focusVisible: link.matches(':focus-visible'),
          }
        })
        await testInfo.attach('contrast-and-focus', {
          body: JSON.stringify(appearance, null, 2),
          contentType: 'application/json',
        })
        expect(appearance.textContrast).toBeGreaterThanOrEqual(4.5)
        expect(appearance.focusContrast).toBeGreaterThanOrEqual(3)
        expect(appearance.outlineStyle).toBe('solid')
        expect(appearance.outlineWidth).toBeGreaterThanOrEqual(2)
        expect(appearance.outlineOffset).toBeGreaterThanOrEqual(2)
        expect(appearance.underline).toContain('underline')
        expect(appearance.focusVisible).toBe(true)
        await testInfo.attach('footer-focused', {
          body: await footer.screenshot(),
          contentType: 'image/png',
        })

        const layout = await footer.evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
          const rects: DOMRect[] = []
          while (walker.nextNode()) {
            if (!walker.currentNode.textContent?.trim()) continue
            const range = document.createRange()
            range.selectNodeContents(walker.currentNode)
            rects.push(...Array.from(range.getClientRects()))
          }
          return {
            overflow: element.scrollWidth > element.clientWidth,
            clipped: rects.some(
              (rect) =>
                rect.left < Math.max(0, bounds.left) - 1 ||
                rect.right > Math.min(innerWidth, bounds.right) + 1 ||
                rect.top < bounds.top - 1 ||
                rect.bottom > bounds.bottom + 1
            ),
            overlap: rects.some((a, i) =>
              rects
                .slice(i + 1)
                .some(
                  (b) =>
                    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
                )
            ),
          }
        })
        expect(layout).toEqual({ overflow: false, clipped: false, overlap: false })

        // No interception: this must be the candidate's real CMS-backed feed.
        const feed = await page.request.get('/feed.xml')
        expect(feed.status()).toBe(200)
        expect(feed.headers()['content-type']).toMatch(/^application\/rss\+xml\b/)
        const xml = await feed.text()
        const parsed = await page.evaluate((xml) => {
          const document = new DOMParser().parseFromString(xml, 'application/xml')
          return {
            errors: document.querySelectorAll('parsererror').length,
            root: document.documentElement.tagName,
            version: document.documentElement.getAttribute('version'),
            channels: document.querySelectorAll('rss > channel').length,
            items: document.querySelectorAll('rss > channel > item').length,
          }
        }, xml)
        expect(parsed).toMatchObject({ errors: 0, root: 'rss', version: '2.0', channels: 1 })
        expect(parsed.items).toBeGreaterThan(0)

        const [navigation] = await Promise.all([
          page.waitForNavigation(),
          page.keyboard.press('Enter'),
        ])
        expect(navigation?.status()).toBe(200)
        expect(navigation?.headers()['content-type']).toMatch(/^application\/rss\+xml\b/)
        expect(new URL(page.url()).pathname).toBe('/feed.xml')
      })
    }
  }
}
