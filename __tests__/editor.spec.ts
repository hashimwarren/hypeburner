import { test, expect } from '@playwright/test'

test.describe('Local Tiptap Editor', () => {
  test('can write, format, and export markdown', async ({ page }) => {
    await page.goto('/editor')

    await expect(page.getByRole('heading', { name: 'Local Markdown Editor' })).toBeVisible()

    // Type content
    const editor = page.getByTestId('tiptap-editor')
    await editor.click()
    await page.keyboard.type('Hello world ')

    // Bold the word
    await page.getByRole('button', { name: 'Bold' }).click()
    await page.keyboard.type('bold')

    // Read markdown output
    const md = page.locator('#markdown-output')
    await expect(md).toHaveValue(/Hello world/)
    await expect(md).toHaveValue(/\*\*bold\*\*/)
  })
})
