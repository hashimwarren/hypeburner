import { expect, test } from '@playwright/test'

const homePage = 'http://localhost:3000/'

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

    await page.goto(homePage)
    await expect(page.locator('#newsletter-email')).toBeVisible()
    await page.fill('#newsletter-email', 'reader@example.com')
    await page.click('button:has-text("Subscribe")')

    const newsletterSection = page.locator('#newsletter-email').locator('../..')
    await expect(
      newsletterSection.getByText('You are subscribed. Welcome to the newsletter.', { exact: true })
    ).toBeVisible({
      timeout: 10000,
    })
  })

  test('shows validation message for invalid email', async ({ page }) => {
    await page.goto(homePage)
    await expect(page.locator('#newsletter-email')).toBeVisible()
    await page.fill('#newsletter-email', 'bad-email')
    await page.click('button:has-text("Subscribe")')

    const newsletterSection = page.locator('#newsletter-email').locator('../..')
    await expect(
      newsletterSection.getByText('Please enter a valid email address.', { exact: true })
    ).toBeVisible({
      timeout: 10000,
    })
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

    await page.goto(homePage)
    await expect(page.locator('#newsletter-email')).toBeVisible()
    await page.fill('#newsletter-email', 'reader@example.com')
    await page.click('button:has-text("Subscribe")')

    const newsletterSection = page.locator('#newsletter-email').locator('../..')
    await expect(
      newsletterSection.getByText(
        "We couldn't subscribe you right now. Please try again shortly.",
        {
          exact: true,
        }
      )
    ).toBeVisible({ timeout: 10000 })
  })
})
