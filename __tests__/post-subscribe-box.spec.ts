import { expect, test } from '@playwright/test'

const articlePath = process.env.ISSUE_SIGNUP_TEST_PATH || '/blog/2026-05-25'

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 375, 640, 768, 1024, 1280]) {
    test(`compact issue signup at ${width}px in ${theme} mode`, async ({ page }, testInfo) => {
      let requests = 0
      await page.route('**/api/newsletter', async (route) => {
        requests += 1
        await route.abort()
      })
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme: theme })
      await page.addInitScript((theme) => localStorage.setItem('theme', theme), theme)
      expect((await page.goto(articlePath))?.status()).toBe(200)
      await page.evaluate(() => document.fonts.ready)
      await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))

      const email = page.getByRole('textbox', { name: 'Email address' })
      const button = page.getByRole('button', { name: 'Send me the next issue' })
      const card = email.locator('../..')
      await expect(email).toHaveCount(1)
      await expect(card.getByRole('heading', { name: 'Developer Tool News' })).toBeVisible()
      await expect(button).toBeVisible()
      const fieldBounds = (await email.boundingBox())!
      const buttonBounds = (await button.boundingBox())!
      const cardBounds = (await card.boundingBox())!
      expect(fieldBounds.height).toBeGreaterThanOrEqual(44)
      expect(buttonBounds.height).toBeGreaterThanOrEqual(44)
      expect(fieldBounds.x).toBeGreaterThan(cardBounds.x)
      expect(buttonBounds.x + buttonBounds.width).toBeLessThanOrEqual(
        cardBounds.x + cardBounds.width
      )
      if (width < 640) {
        expect(buttonBounds.y).toBeGreaterThanOrEqual(fieldBounds.y + fieldBounds.height)
        expect(Math.abs(buttonBounds.width - fieldBounds.width)).toBeLessThanOrEqual(1)
      } else {
        expect(Math.abs(buttonBounds.y - fieldBounds.y)).toBeLessThanOrEqual(1)
        expect(buttonBounds.x).toBeGreaterThanOrEqual(fieldBounds.x + fieldBounds.width)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false
      )
      expect(await button.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
        false
      )
      await email.focus()
      await expect(email).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(button).toBeFocused()
      await button.click({ trial: true })
      expect(requests).toBe(0)
      await testInfo.attach('issue-signup', {
        body: await card.screenshot(),
        contentType: 'image/png',
      })
    })
  }
}

test('issue signup validates, shows pending and error states, and retries successfully', async ({
  page,
}) => {
  let requests = 0
  let finishRequest!: () => void
  await page.route('**/api/newsletter', async (route) => {
    requests += 1
    expect(route.request().method()).toBe('POST')
    expect(route.request().postDataJSON()).toEqual({ email: 'reader@example.com' })
    if (requests === 1) {
      await new Promise<void>((resolve) => (finishRequest = resolve))
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, message: 'Please try again shortly.' }),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          message: 'You are subscribed. Welcome to the newsletter.',
        }),
      })
    }
  })
  await page.goto(articlePath)
  const email = page.getByRole('textbox', { name: 'Email address' })
  const submit = page.getByRole('button', { name: 'Send me the next issue' })
  await email.fill('invalid')
  await submit.click()
  expect(await email.evaluate((field: HTMLInputElement) => field.validity.valid)).toBe(false)
  expect(requests).toBe(0)
  await email.fill('Reader@Example.COM')
  await submit.click()
  await expect(page.getByRole('button', { name: 'Subscribing...' })).toBeDisabled()
  await expect(email).toBeDisabled()
  await expect.poll(() => requests).toBe(1)
  finishRequest()
  await expect(page.getByText('Please try again shortly.', { exact: true })).toBeVisible()
  await expect(email).toHaveValue('Reader@Example.COM')
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(
    page.getByText('You are subscribed. Welcome to the newsletter.', { exact: true })
  ).toBeVisible()
  await expect(email).toHaveValue('')
  await expect(submit).toBeEnabled()
  expect(requests).toBe(2)
})
