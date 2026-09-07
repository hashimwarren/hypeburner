import { createHash } from 'node:crypto'
import { expect, test, type Locator } from '@playwright/test'

const articlePath = '/blog/2026-05-25'

async function measureClearance(top: Locator, mobile: boolean) {
  return top.evaluate((button, mobile) => {
    const bounds = button.getBoundingClientRect()
    const gap = mobile ? 8 : 0
    const intersects = (rect: DOMRect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      Math.min(rect.right, bounds.right + gap) - Math.max(rect.left, bounds.left - gap) > 1 &&
      Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top) > 1
    const collisions: { name: string; rect: ReturnType<DOMRect['toJSON']> }[] = []
    const controlBounds: { name: string; rect: ReturnType<DOMRect['toJSON']> }[] = []
    for (const root of document.querySelectorAll('main, footer[role="contentinfo"]')) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode
        if (!node.textContent?.trim() || button.parentElement?.contains(node)) continue
        if (node.parentElement?.closest('script, style, .sr-only, [hidden]')) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const rect of range.getClientRects()) {
          if (intersects(rect))
            collisions.push({ name: node.textContent.trim().slice(0, 100), rect: rect.toJSON() })
        }
      }
      for (const control of root.querySelectorAll('a, button, input, select, textarea, iframe')) {
        if (button.parentElement?.contains(control)) continue
        const rect = control.getBoundingClientRect()
        if (rect.bottom <= 0 || rect.top >= innerHeight || !rect.width || !rect.height) continue
        const name =
          control.getAttribute('aria-label') ||
          control.textContent?.trim().slice(0, 80) ||
          control.tagName
        controlBounds.push({ name, rect: rect.toJSON() })
        for (const fragment of control.getClientRects()) {
          if (intersects(fragment)) collisions.push({ name, rect: fragment.toJSON() })
        }
      }
    }
    return {
      scrollY,
      button: bounds.toJSON(),
      controlBounds,
      collisions,
      gap,
      overflow: document.documentElement.scrollWidth > innerWidth,
      receivesPointer: button.contains(
        document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
      ),
    }
  }, mobile)
}

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 375, 767, 768, 1280]) {
    test(`article scroll controls at ${width}px in ${theme} mode`, async ({ page }, testInfo) => {
      test.setTimeout(90_000)
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme: theme })
      await page.addInitScript((theme) => localStorage.setItem('theme', theme), theme)
      const response = await page.goto(articlePath)
      expect(response?.status()).toBe(200)
      await expect(page.locator('article')).toBeVisible()
      await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))
      await page.evaluate(() => document.fonts.ready)
      await testInfo.attach('cms-content', {
        body: JSON.stringify({
          path: articlePath,
          proseSHA256: createHash('sha256')
            .update(await page.locator('article .prose').innerHTML())
            .digest('hex'),
          geometry: await page.locator('article').evaluate((article) => ({
            font: getComputedStyle(article).fontFamily,
            padding: getComputedStyle(article).paddingRight,
            rect: article.getBoundingClientRect().toJSON(),
          })),
        }),
        contentType: 'application/json',
      })

      const top = page.getByRole('button', { name: 'Scroll To Top', includeHidden: true })
      const comment = page.getByRole('button', { name: 'Scroll To Comment', includeHidden: true })
      const marker = page.locator('[data-article-scroll-controls]')
      await expect(top).toHaveCount(1)
      // Wait for a positive client-state update before testing the threshold in both directions.
      for (const y of [100, 0, 50, 51, 100, 0, 51]) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y)
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(y)
        if (y > 50) await expect(top).toBeVisible()
        else await expect(top).toBeHidden()
        await expect(marker).toHaveCount(1)
        await expect(page.locator('article')).toHaveCSS(
          'padding-right',
          width < 768 ? '36px' : '0px'
        )
        await expect(page.getByRole('contentinfo')).toHaveCSS(
          'padding-right',
          width < 768 ? '52px' : '0px'
        )
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
      await expect(async () => {
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
        expect(focus.width).toBe(2)
        expect(focus.color).not.toBe('rgba(0, 0, 0, 0)')
        expect(focus.color).not.toBe('transparent')
      }).toPass({ timeout: 5000 })
      await testInfo.attach('keyboard-focus', {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
      await page.keyboard.press('Enter')
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
      await expect(top).toBeHidden()
      const afterHiding = await page.evaluate(() => document.activeElement?.outerHTML)
      await page.keyboard.press('Tab')
      const nextFocus = page.locator(':focus')
      await expect(nextFocus).toBeVisible()
      await expect(nextFocus).toBeEnabled()
      await expect(top).not.toBeFocused()
      await expect(async () => {
        const focus = await nextFocus.evaluate((element) => ({
          operable: element.matches('a[href], button, input, select, textarea'),
          visible: element.matches(':focus-visible'),
          outline: parseFloat(getComputedStyle(element).outlineWidth),
        }))
        expect(focus.operable).toBe(true)
        expect(focus.visible).toBe(true)
        expect(focus.outline).toBeGreaterThan(0)
      }).toPass({ timeout: 5000 })
      await testInfo.attach('focus-after-hiding', {
        body: JSON.stringify({
          afterHiding,
          afterTab: await nextFocus.evaluate((e) => e.outerHTML),
        }),
        contentType: 'application/json',
      })

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
      await page.evaluate(() => document.fonts.ready)
      await top.click()
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

      if (width === 320 || width === 375) {
        const email = page.locator('article input[type="email"]:visible')
        const subscribe = page.locator('article button[type="submit"]:visible')
        await email.fill('reader@example.com')
        await expect(email).toHaveValue('reader@example.com')
        await page.keyboard.press('Tab')
        await expect(subscribe).toBeFocused()
        await expect(subscribe).toBeEnabled()
        await subscribe.click({ trial: true })
        const subscription = await page.locator('article form:visible').evaluate((form) => {
          const input = form.querySelector('input')!
          const button = form.querySelector('button')!
          return {
            input: input.getBoundingClientRect().toJSON(),
            button: button.getBoundingClientRect().toJSON(),
            buttonTextFits: button.scrollWidth <= button.clientWidth,
          }
        })
        expect(subscription.input.width).toBeGreaterThanOrEqual(120)
        expect(subscription.button.width).toBeGreaterThanOrEqual(120)
        expect(subscription.buttonTextFits).toBe(true)
        await testInfo.attach('subscription-geometry', {
          body: JSON.stringify(subscription),
          contentType: 'application/json',
        })
        await testInfo.attach('subscription-usable', {
          body: await page.screenshot(),
          contentType: 'image/png',
        })
        // Never submit a real newsletter signup during geometry acceptance.
        await email.fill('')
      }

      // Inspect actual text/control rectangles, not just page-bottom padding.
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
        const clearance = await measureClearance(top, width < 768)
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
        expect.soft(clearance.receivesPointer, selector).toBe(true)
      }

      if (width < 768) {
        // 32px intervals overlap the 44px target's band, covering every paragraph through the footer.
        const maximum = await page.evaluate(
          () => document.documentElement.scrollHeight - innerHeight
        )
        const positions = new Set([712, maximum])
        for (let y = 51; y < maximum; y += 32) positions.add(y)
        const failures: Awaited<ReturnType<typeof measureClearance>>[] = []
        for (const y of [...positions].sort((a, b) => a - b)) {
          await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y)
          await expect(top).toBeVisible()
          const clearance = await measureClearance(top, true)
          if (clearance.overflow || clearance.collisions.length || !clearance.receivesPointer)
            failures.push(clearance)
          if (y === 712 || y === maximum) {
            await testInfo.attach(`sweep-${y}`, {
              body: await page.screenshot(),
              contentType: 'image/png',
            })
          }
        }
        await testInfo.attach('complete-mobile-sweep', {
          body: JSON.stringify({ maximum, samples: positions.size, failures }, null, 2),
          contentType: 'application/json',
        })
        expect(failures).toEqual([])
      }

      if ((width === 320 || width === 1280) && theme === 'light') {
        for (const path of ['/', '/blog']) {
          await page.goto(path)
          await expect(page.locator('[data-article-scroll-controls]')).toHaveCount(0)
          await expect(page.getByRole('contentinfo')).toHaveCSS('padding-right', '0px')
        }
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
    const opener = page.getByRole('button', { name: 'Toggle Menu', exact: true })
    await opener.click()
    const dialog = page.getByRole('dialog')
    const navigation = dialog.getByRole('navigation')
    await expect(navigation).toBeVisible()
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
    await expect(navigation).toBeHidden()
    await expect(opener).toBeFocused()
    await top.click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  })
}
