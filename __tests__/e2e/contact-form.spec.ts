import { test, expect } from '@playwright/test';

test.describe('Contact Form E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the contact page
    await page.goto('/contact');
  });

  test('should submit contact form successfully', async ({ page }) => {
    // Fill out the form
    await page.fill('[name="name"]', 'E2E Test User');
    await page.fill('[name="email"]', 'e2e@test.com');
    await page.selectOption('[name="type"]', 'General Inquiry');
    await page.fill('[name="message"]', 'This is an end-to-end test message.');

    // Mock the API response
    await page.route('/api/contact', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
    });

    // Submit the form
    await page.click('button[type="submit"]');

    // Check for success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Thank you');
  });

  test('should show error message on API failure', async ({ page }) => {
    // Fill out the form
    await page.fill('[name="name"]', 'E2E Test User');
    await page.fill('[name="email"]', 'e2e@test.com');
    await page.selectOption('[name="type"]', 'General Inquiry');
    await page.fill('[name="message"]', 'This is an end-to-end test message.');

    // Mock the API to return an error
    await page.route('/api/contact', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to send message. Please try again later.' }),
      });
    });

    // Submit the form
    await page.click('button[type="submit"]');

    // Check for error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to send message');
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Check for validation errors
    await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="type-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-error"]')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.fill('[name="name"]', 'Test User');
    await page.fill('[name="email"]', 'invalid-email');
    await page.selectOption('[name="type"]', 'General Inquiry');
    await page.fill('[name="message"]', 'Test message');

    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-error"]')).toContainText('valid email');
  });

  test('should disable submit button while submitting', async ({ page }) => {
    await page.fill('[name="name"]', 'Test User');
    await page.fill('[name="email"]', 'test@example.com');
    await page.selectOption('[name="type"]', 'General Inquiry');
    await page.fill('[name="message"]', 'Test message');

    // Mock API with delay
    await page.route('/api/contact', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
    });

    const submitButton = page.locator('button[type="submit"]');
    
    await submitButton.click();

    // Check that button is disabled during submission
    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toContainText('Sending...');

    // Wait for submission to complete
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  test('should reset form after successful submission', async ({ page }) => {
    await page.fill('[name="name"]', 'Test User');
    await page.fill('[name="email"]', 'test@example.com');
    await page.selectOption('[name="type"]', 'General Inquiry');
    await page.fill('[name="message"]', 'Test message');

    await page.route('/api/contact', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
    });

    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

    // Check that form is reset
    await expect(page.locator('[name="name"]')).toHaveValue('');
    await expect(page.locator('[name="email"]')).toHaveValue('');
    await expect(page.locator('[name="message"]')).toHaveValue('');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.fill('[name="name"]', 'Test User');
    await page.fill('[name="email"]', 'test@example.com');
    await page.selectOption('[name="type"]', 'General Inquiry');
    await page.fill('[name="message"]', 'Test message');

    // Mock network failure
    await page.route('/api/contact', async (route) => {
      await route.abort();
    });

    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('network');
  });
});