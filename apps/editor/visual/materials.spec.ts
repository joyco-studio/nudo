import { expect, test } from '@playwright/test'

for (const scene of ['ink-swirl', 'pencil', 'poster']) {
  test(scene, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.goto(`/visual/index.html?scene=${scene}`)
    const canvas = page.getByLabel('Visual fixture')
    try {
      await expect(canvas).toHaveAttribute('data-status', /^(ready|error)$/, { timeout: 30_000 })
      expect(await canvas.getAttribute('data-error')).toBeNull()
      await expect(canvas).toHaveAttribute('data-status', 'ready')
      expect(errors).toEqual([])
      await expect(canvas).toHaveAttribute('width', '400')
      await expect(canvas).toHaveAttribute('height', '250')
      const image = await canvas.screenshot({
        path: testInfo.outputPath(`${scene}-candidate.png`),
        animations: 'disabled',
      })
      expect(image).toMatchSnapshot(`${scene}.png`, { threshold: 0.1, maxDiffPixels: 0 })
    } finally {
      await testInfo.attach('renderer-status', {
        body: JSON.stringify({
          scene,
          status: await canvas.getAttribute('data-status'),
          error: await canvas.getAttribute('data-error'),
          consoleErrors: errors,
        }),
        contentType: 'application/json',
      })
    }
  })
}
