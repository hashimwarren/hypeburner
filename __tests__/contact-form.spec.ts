import { test, expect } from '@playwright/test'

test.describe('Contact Form', () => {
  test('shows actionable error when contact API fails', async ({ page }) => {
    await page.route('**/api/contact', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'ERR_EMAIL_SEND',
          message: "We couldn't send your message right now. Please try again in a few minutes.",
        }),
      })
    })

    await page.goto('http://localhost:3000/contact')

    await page.waitForSelector('h1', { timeout: 10000 })
    await page.fill('#name', 'Test User')
    await page.fill('#email', 'testuser@example.com')
    await page.fill('#message', 'This is a test message.')

    await page.click('button[type="submit"]')

    await expect(
      page.getByText("We couldn't send your message right now. Please try again in a few minutes.")
    ).toBeVisible({ timeout: 10000 })
  })
})
