/**
 * E2E tests — Login flow
 * Run: npx playwright test e2e/tests/login.spec.ts
 */
import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'

test.describe('Login', () => {
  test('shows login page at root redirect', async ({ page }) => {
    await page.goto(BASE_URL)
    await expect(page).toHaveURL(/login/)
    await expect(page.getByRole('heading', { name: /sign in|login/i })).toBeVisible()
  })

  test('shows validation error on empty submit', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.click('button[type=submit]')
    await expect(page.getByText(/required|email/i).first()).toBeVisible()
  })

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type=email]',    'wrong@example.com')
    await page.fill('input[type=password]', 'wrongpassword')
    await page.click('button[type=submit]')
    await expect(page.getByText(/invalid|incorrect|credentials/i).first()).toBeVisible({ timeout: 5000 })
  })
})
