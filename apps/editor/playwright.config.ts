import { defineConfig, devices } from '@playwright/test'

/** Override with E2E_PORT to run suites from several worktrees side by side. */
const PORT = Number(process.env.E2E_PORT ?? 5173)
const BASE_URL = `http://localhost:${String(PORT)}`
const isCi = Boolean(process.env.CI)

/**
 * `E2E_GPU=1` adds a GPU-backed run (WebGPU on, Metal ANGLE on macOS) of the preview specs. The
 * default headless run has no GPU, so it only ever exercises the WebGL2 fallback in software;
 * this one checks node previews copied from a WebGPU canvas and gives realistic frame costs.
 */
const gpuProjects = process.env.E2E_GPU
  ? [
      {
        name: 'chromium-gpu',
        testMatch: /(node-previews|preview)\.spec\.ts/,
        use: {
          ...devices['Desktop Chrome'],
          channel: 'chromium',
          launchOptions: {
            args: ['--enable-unsafe-webgpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
          },
        },
      },
    ]
  : []

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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, ...gpuProjects],
  webServer: {
    command: `pnpm exec vite --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !isCi,
  },
})
