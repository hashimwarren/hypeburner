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
    const email = page.locator('#home-newsletter-email-top')
    const newsletterSection = email.locator('../..')
    await expect(email).toBeVisible()
    await email.fill('reader@example.com')
    await newsletterSection.getByRole('button', { name: 'Subscribe', exact: true }).click()

    await expect(
      newsletterSection.getByText('You are subscribed. Welcome to the newsletter.', { exact: true })
    ).toBeVisible({
      timeout: 10000,
    })
  })

  test('blocks invalid email with browser validation without submitting', async ({ page }) => {
    let subscriptionRequests = 0
    await page.route('**/api/newsletter', async (route) => {
      subscriptionRequests += 1
      await route.abort()
    })

    await page.goto(homePage)
    const email = page.locator('#home-newsletter-email-top')
    const newsletterSection = email.locator('../..')
    await expect(email).toBeVisible()
    await email.fill('bad-email')
    await newsletterSection.getByRole('button', { name: 'Subscribe', exact: true }).click()

    await expect(email).toBeFocused()
    expect(await email.evaluate((input: HTMLInputElement) => input.validity.typeMismatch)).toBe(
      true
    )
    expect(await email.evaluate((input: HTMLInputElement) => input.validationMessage)).not.toBe('')
    expect(subscriptionRequests).toBe(0)
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
    const email = page.locator('#home-newsletter-email-top')
    const newsletterSection = email.locator('../..')
    await expect(email).toBeVisible()
    await email.fill('reader@example.com')
    await newsletterSection.getByRole('button', { name: 'Subscribe', exact: true }).click()

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
