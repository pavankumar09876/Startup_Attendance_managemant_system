import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:  './tests',
  timeout:  30_000,
  retries:  process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL:       process.env.BASE_URL ?? 'http://localhost:5173',
    screenshot:    'only-on-failure',
    video:         'retain-on-failure',
    trace:         'on-first-retry',
  },

  projects: [
    {
      name:  'chromium',
      use:   { ...devices['Desktop Chrome'] },
    },
    {
      name:  'firefox',
      use:   { ...devices['Desktop Firefox'] },
    },
    {
      name:  'Mobile Safari',
      use:   { ...devices['iPhone 13'] },
    },
  ],

  webServer: process.env.CI ? undefined : {
    command: 'cd ../frontend && npm run dev',
    port:    5173,
    reuseExistingServer: true,
  },
})
