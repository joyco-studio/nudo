import { defineConfig, devices } from '@playwright/test'

/** Override with E2E_PORT to run suites from several worktrees side by side. */
const PORT = Number(process.env.E2E_PORT ?? 5173)
const BASE_URL = `http://localhost:${String(PORT)}`
const isCi = Boolean(process.env.CI)

/**
 * Worker processes. Every page renders its previews with software WebGL (SwiftShader), which keeps
 * several cores busy per browser, so the default (half the cores: 9 on an 18-core machine) starved
 * the frame-sensitive specs. Six stays clear of that here; CI runners have two to four cores.
 */
const WORKERS = isCi ? 2 : 6

/**
 * Specs that open the 120-node pond or render many node previews. They run one at a time in
 * their own project, so two of them never fight over the CPU.
 */
const HEAVY_SPECS = /(pond|pond-performance|phase-2-golden-path|node-previews)\.spec\.ts/

/**
 * `E2E_GPU=1` (exactly) adds a GPU-backed run (WebGPU on, Metal ANGLE on macOS) of the preview
 * specs. The default headless run has no GPU, so it only exercises the WebGL2 fallback in
 * software; this one checks node previews copied from a WebGPU canvas, with realistic frame costs.
 */
const gpuProjects =
  process.env.E2E_GPU === '1'
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
  workers: WORKERS,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  // On CI the HTML report is written to playwright-report/ and uploaded when the job fails.
  reporter: isCi ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', testIgnore: HEAVY_SPECS, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium-heavy',
      testMatch: HEAVY_SPECS,
      workers: 1,
      use: { ...devices['Desktop Chrome'] },
    },
    ...gpuProjects,
  ],
  webServer: {
    command: `pnpm exec vite --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !isCi,
  },
})
