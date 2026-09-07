import { expect, test } from '@playwright/test'

const articlePath = '/blog/2026-05-25'

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 375, 767, 768, 1280]) {
    test(`article scroll controls at ${width}px in ${theme} mode`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme: theme })
      await page.addInitScript((theme) => localStorage.setItem('theme', theme), theme)
      const response = await page.goto(articlePath)
      expect(response?.status()).toBe(200)
      await expect(page.locator('article')).toBeVisible()
      await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))

      const top = page.getByRole('button', { name: 'Scroll To Top', includeHidden: true })
      const comment = page.getByRole('button', { name: 'Scroll To Comment', includeHidden: true })
      await expect(top).toHaveCount(1)
      // Wait for a positive client-state update before testing the threshold in both directions.
      for (const y of [100, 0, 50, 51, 100, 0, 51]) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y)
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(y)
        if (y > 50) await expect(top).toBeVisible()
        else await expect(top).toBeHidden()
      }
      if (width < 768) await expect(comment).toBeHidden()
      else await expect(comment).toBeVisible()

      const bounds = await top.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.width).toBe(width < 768 ? 44 : 36)
      expect(bounds!.height).toBe(width < 768 ? 44 : 36)
      expect(width - bounds!.x - bounds!.width).toBe(width < 768 ? 16 : 32)
      expect(900 - bounds!.y - bounds!.height).toBe(width < 768 ? 16 : 32)
      await testInfo.attach('control-bounds', {
        body: JSON.stringify({ width, theme, bounds }),
        contentType: 'application/json',
      })
      await top.click()
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
      await expect(top).toBeHidden()

      await page.evaluate(() => window.scrollTo({ top: 100, behavior: 'instant' }))
      await expect(top).toBeVisible()
      await top.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(top).toBeFocused()
      const focus = await top.evaluate((button) => {
        const style = getComputedStyle(button)
        return {
          visible: button.matches(':focus-visible'),
          style: style.outlineStyle,
          width: parseFloat(style.outlineWidth),
          color: style.outlineColor,
        }
      })
      expect(focus.visible).toBe(true)
      expect(focus.style).toBe('solid')
      expect(focus.width).toBeGreaterThan(0)
      expect(focus.color).not.toBe('rgba(0, 0, 0, 0)')
      await testInfo.attach('keyboard-focus', {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      await page.keyboard.press('Enter')
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
      await expect(top).toBeHidden()

      if (width >= 768) {
        await page.evaluate(() => window.scrollTo({ top: 100, behavior: 'instant' }))
        await comment.click()
        await expect(page.locator('#comment')).toBeInViewport()
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
      }

      // Real reload restoration is supplementary; deterministic pre-mount state is tested in Jest.
      await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }))
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400)
      const reload = await page.reload()
      expect(reload?.status()).toBe(200)
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400)
      await expect(top).toBeVisible()
      await top.click()
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

      // Inspect real text and controls at representative article/end-of-page positions.
      const regions = [
        { name: 'article-header', locator: page.locator('article header') },
        { name: 'article-body', locator: page.locator('article .prose') },
        { name: 'comments', locator: page.locator('#comment') },
        { name: 'article-navigation', locator: page.locator('article footer') },
        { name: 'site-footer', locator: page.getByRole('contentinfo') },
      ]
      for (const { name: selector, locator: region } of regions) {
        await expect(region).toHaveCount(1)
        await region.evaluate(
          (element, isHeader) =>
            element.scrollIntoView({ block: isHeader ? 'start' : 'end', behavior: 'instant' }),
          selector === 'article-header'
        )
        await expect(top).toBeVisible()
        await top.click({ trial: true })
        const clearance = await top.evaluate((button) => {
          const bounds = button.getBoundingClientRect()
          const intersects = (rect: DOMRect) =>
            rect.width > 0 &&
            rect.height > 0 &&
            Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left) > 1 &&
            Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top) > 1
          const collisions: string[] = []
          const controlBounds: { name: string; rect: ReturnType<DOMRect['toJSON']> }[] = []
          for (const root of document.querySelectorAll('main, footer')) {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
            while (walker.nextNode()) {
              const node = walker.currentNode
              if (!node.textContent?.trim() || button.parentElement?.contains(node)) continue
              if (node.parentElement?.closest('script, style, .sr-only, [hidden]')) continue
              const range = document.createRange()
              range.selectNodeContents(node)
              if (Array.from(range.getClientRects()).some(intersects))
                collisions.push(node.textContent.trim().slice(0, 100))
            }
            for (const control of root.querySelectorAll(
              'a, button, input, select, textarea, iframe'
            )) {
              if (button.parentElement?.contains(control)) continue
              const rect = control.getBoundingClientRect()
              if (rect.bottom <= 0 || rect.top >= innerHeight || !rect.width || !rect.height)
                continue
              const name =
                control.getAttribute('aria-label') ||
                control.textContent?.trim().slice(0, 80) ||
                control.tagName
              controlBounds.push({ name, rect: rect.toJSON() })
              if (intersects(rect)) collisions.push(name)
            }
          }
          return {
            scrollY,
            button: bounds.toJSON(),
            controlBounds,
            collisions,
            overflow: document.documentElement.scrollWidth > innerWidth,
          }
        })
        await testInfo.attach(`clearance-${selector}`, {
          body: JSON.stringify(clearance, null, 2),
          contentType: 'application/json',
        })
        await testInfo.attach(`position-${selector}`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        })
        expect.soft(clearance.overflow, selector).toBe(false)
        expect.soft(clearance.collisions, selector).toEqual([])
      }
    })
  }
}

for (const width of [320, 375]) {
  test(`mobile menu stays above scroll controls and isolates focus at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const response = await page.goto(articlePath)
    expect(response?.status()).toBe(200)
    await expect(page.locator('article')).toBeVisible()
    const top = page.getByRole('button', { name: 'Scroll To Top', includeHidden: true })
    await page.evaluate(() => window.scrollTo({ top: 51, behavior: 'instant' }))
    await expect(top).toBeVisible()
    await page.getByRole('button', { name: 'Toggle Menu', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(top).toBeVisible()
    await expect
      .poll(() =>
        top.evaluate((button) => {
          const rect = button.getBoundingClientRect()
          return !button.contains(
            document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          )
        })
      )
      .toBe(true)
    for (let index = 0; index < 10; index++) {
      await page.keyboard.press('Tab')
      await expect
        .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
        .toBe(true)
      await expect(top).not.toBeFocused()
    }
    await testInfo.attach('menu-over-scroll-control', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await top.click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  })
}
