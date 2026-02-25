import { expect, test } from '@playwright/test'

test.describe('Newsletter Form', () => {
  test('subscribes successfully with a valid email', async ({ page }) => {
    await page.route('**/api/newsletter', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          code: 'OK',
          message: 'You are subscribed. Welcome to the newsletter.',
        }),
      })
    })

    await page.goto('http://localhost:3000/')
    await page.fill('#newsletter-email', 'reader@example.com')
    await page.click('button:has-text("Subscribe")')

    await expect(page.getByText('You are subscribed. Welcome to the newsletter.')).toBeVisible()
  })

  test('shows validation message for invalid email', async ({ page }) => {
    await page.goto('http://localhost:3000/')
    await page.fill('#newsletter-email', 'bad-email')
    await page.click('button:has-text("Subscribe")')

    await expect(page.getByText('Please enter a valid email address.')).toBeVisible()
  })

  test('shows actionable message when API fails', async ({ page }) => {
    await page.route('**/api/newsletter', async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          code: 'ERR_NEWSLETTER_UPSTREAM',
          message: "We couldn't subscribe you right now. Please try again shortly.",
        }),
      })
    })

    await page.goto('http://localhost:3000/')
    await page.fill('#newsletter-email', 'reader@example.com')
    await page.click('button:has-text("Subscribe")')

    await expect(
      page.getByText("We couldn't subscribe you right now. Please try again shortly.")
    ).toBeVisible()
  })
})
