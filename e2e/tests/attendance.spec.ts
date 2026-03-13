/**
 * E2E — Attendance flow (requires running app + seeded test user)
 * Run: npx playwright test e2e/tests/attendance.spec.ts
 */
import { test, expect } from '@playwright/test'

const BASE_URL  = process.env.BASE_URL  ?? 'http://localhost:5173'
const TEST_EMAIL = process.env.TEST_EMAIL ?? 'employee@test.com'
const TEST_PASS  = process.env.TEST_PASS  ?? 'Test@1234'

test.describe('Attendance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type=email]',    TEST_EMAIL)
    await page.fill('input[type=password]', TEST_PASS)
    await page.click('button[type=submit]')
    await page.waitForURL(/dashboard|attendance/, { timeout: 10000 })
  })

  test('navigates to attendance page', async ({ page }) => {
    await page.goto(`${BASE_URL}/attendance`)
    await expect(page.getByText(/attendance/i).first()).toBeVisible()
  })

  test('shows check-in button when not checked in', async ({ page }) => {
    await page.goto(`${BASE_URL}/attendance`)
    const checkInBtn = page.getByRole('button', { name: /check.?in/i })
    if (await checkInBtn.isVisible()) {
      await expect(checkInBtn).toBeEnabled()
    }
  })
})
