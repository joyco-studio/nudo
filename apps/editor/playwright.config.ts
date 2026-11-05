import { defineConfig, devices } from '@playwright/test'

/** Override with E2E_PORT to run suites from several worktrees side by side. */
const PORT = Number(process.env.E2E_PORT ?? 5173)
const BASE_URL = `http://localhost:${String(PORT)}`
const isCi = Boolean(process.env.CI)

/**
 * The MCP Worker (`wrangler dev`) the agent specs talk to. Override with E2E_MCP_PORT when 8787 is
 * taken. Its bridge only accepts the editor's origin, so the Worker gets this run's origin.
 */
const MCP_PORT = Number(process.env.E2E_MCP_PORT ?? 8787)
const MCP_URL = `http://localhost:${String(MCP_PORT)}`
/** wrangler's inspector port; one per Worker, so a second worktree's run needs its own too. */
const MCP_INSPECTOR_PORT = MCP_PORT + 1000

/**
 * Worker processes. Every page renders its previews with software WebGL (SwiftShader), which keeps
 * several cores busy per browser, so the default (half the cores: 9 on an 18-core machine) starved
 * the frame-sensitive specs. Six stays clear of that here; CI runners have two to four cores.
 */
const WORKERS = isCi ? 2 : 6

/**
 * Per-test and per-assertion budgets. On a two-core runner software WebGL keeps the main thread
 * busy, so a spec that tabs through dozens of controls needs more than Playwright's 30 s and 5 s.
 */
const TEST_TIMEOUT_MS = isCi ? 90_000 : 30_000
const EXPECT_TIMEOUT_MS = isCi ? 15_000 : 5_000

/**
 * Specs that render many node previews at once. They run one at a time in their own project, so
 * two of them never fight over the CPU.
 */
const HEAVY_SPECS = /phase-2-golden-path\.spec\.ts/

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
          testMatch: /preview\.spec\.ts/,
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
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  forbidOnly: isCi,
  // One retry absorbs a slow software-WebGL frame; more only multiplies the cost of a real failure.
  retries: isCi ? 1 : 0,
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
  webServer: [
    {
      // A reused dev server must have been started with VITE_NUDO_MCP_URL set to MCP_URL, or the
      // agent specs find no connection to offer.
      command: `pnpm exec vite --port ${String(PORT)} --strictPort`,
      url: BASE_URL,
      env: { VITE_NUDO_MCP_URL: MCP_URL },
      reuseExistingServer: !isCi,
    },
    {
      command: [
        'pnpm --filter @nudo-tsl/mcp exec wrangler dev',
        `--port ${String(MCP_PORT)}`,
        `--inspector-port ${String(MCP_INSPECTOR_PORT)}`,
        `--var ALLOWED_ORIGINS:${BASE_URL}`,
      ].join(' '),
      // `/mcp` answers 401 without a key, which Playwright counts as up (`/` is a 404).
      url: `${MCP_URL}/mcp`,
      reuseExistingServer: !isCi,
    },
  ],
})
