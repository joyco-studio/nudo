import { defineConfig } from '@playwright/test'

const port = Number(process.env.VISUAL_PORT ?? 5174)
export default defineConfig({
  testDir: './visual',
  testMatch: '**/*.spec.ts',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  outputDir: './test-results/visual',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 45_000,
  forbidOnly: Boolean(process.env.CI),
  // Missing baselines fail too. Generating a candidate is separate from approving it.
  updateSnapshots: 'none',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/visual', open: 'never' }]],
  expect: { toHaveScreenshot: { threshold: 0.1, maxDiffPixels: 0 } },
  use: {
    browserName: 'chromium',
    viewport: { width: 400, height: 250 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    baseURL: `http://127.0.0.1:${String(port)}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(process.env.VISUAL_CHROMIUM_PATH
        ? { executablePath: process.env.VISUAL_CHROMIUM_PATH }
        : {}),
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${String(port)} --strictPort`,
    url: `http://127.0.0.1:${String(port)}`,
    reuseExistingServer: false,
  },
})
