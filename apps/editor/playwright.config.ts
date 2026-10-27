import { defineConfig, devices } from '@playwright/test'

/** Override with E2E_PORT to run suites from several worktrees side by side. */
const PORT = Number(process.env.E2E_PORT ?? 5173)
const BASE_URL = `http://localhost:${String(PORT)}`
const isCi = Boolean(process.env.CI)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  // On CI the HTML report is written to playwright-report/ and uploaded when the job fails.
  reporter: isCi ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec vite --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !isCi,
  },
})
