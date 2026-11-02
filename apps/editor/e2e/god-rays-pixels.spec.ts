import { expect, test, type Page } from '@playwright/test'

import godRays from '../src/examples/god-rays.graph.json' with { type: 'json' }
import { seedAutosave } from './support/seed-graph'

/** Isolate one sparse, white particle layer so beam brightness and overlapping motes cannot skew size. */
function particleDocument(): string {
  return JSON.stringify({
    ...godRays,
    nodes: {
      ...godRays.nodes,
      dustA: { ...godRays.nodes.dustA, inputValues: { scale: { type: 'float', value: 10 } } },
      cellUvA: { ...godRays.nodes.cellUvA, inputValues: { b: { type: 'float', value: 10 } } },
      master: { ...godRays.nodes.master, params: { lighting: 'unlit', surface: 'opaque' } },
    },
    edges: {
      ...Object.fromEntries(
        Object.entries(godRays.edges).filter(
          ([, edge]) => edge.to.nodeId !== 'master' || edge.to.portId === 'position',
        ),
      ),
      particleOutput: {
        id: 'particleOutput',
        from: { nodeId: 'motesA', portId: 'out' },
        to: { nodeId: 'master', portId: 'baseColor' },
      },
    },
    properties: godRays.properties.map((property) =>
      property.name === 'particleSize'
        ? { ...property, value: { type: 'float', value: 6 } }
        : property,
    ),
  })
}

/** Median bounding box of bright connected components, excluding clipped particles and UI text. */
async function particleDimensions(page: Page) {
  const screenshot = await page
    .getByRole('region', { name: 'Main preview' })
    .locator('canvas')
    .screenshot()
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (ctx === null) throw new Error('2D canvas unavailable')
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const { width, height } = canvas
    const { data } = ctx.getImageData(0, 0, width, height)
    const seen = new Uint8Array(width * height)
    const boxes: { width: number; height: number }[] = []
    const inset = 20
    for (let y = inset; y < height - inset; y++) {
      for (let x = inset; x < width - inset; x++) {
        const start = y * width + x
        if (seen[start] || (data[start * 4] ?? 0) < 180) continue
        let left = x,
          right = x,
          top = y,
          bottom = y
        const pending = [start]
        seen[start] = 1
        while (pending.length > 0) {
          const index = pending.pop()
          if (index === undefined) break
          const px = index % width,
            py = Math.floor(index / width)
          left = Math.min(left, px)
          right = Math.max(right, px)
          top = Math.min(top, py)
          bottom = Math.max(bottom, py)
          for (const next of [index - 1, index + 1, index - width, index + width]) {
            const nx = next % width,
              ny = Math.floor(next / width)
            if (nx < inset || nx >= width - inset || ny < inset || ny >= height - inset) continue
            if (seen[next] || (data[next * 4] ?? 0) < 180) continue
            seen[next] = 1
            pending.push(next)
          }
        }
        if (
          left > inset &&
          right < width - inset - 1 &&
          top > inset &&
          bottom < height - inset - 1
        ) {
          boxes.push({ width: right - left + 1, height: bottom - top + 1 })
        }
      }
    }
    const median = (values: number[]) =>
      values.sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0
    return {
      count: boxes.length,
      width: median(boxes.map((b) => b.width)),
      height: median(boxes.map((b) => b.height)),
    }
  }, screenshot.toString('base64'))
}

test('God rays particles keep their pixel diameter across plane stretching and camera zoom', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await seedAutosave(page, particleDocument())
  await page.goto('/')
  const preview = page.getByRole('region', { name: 'Main preview' })
  await preview.getByRole('radio', { name: 'Plane', exact: true }).click()
  const checkSize = async () => {
    await expect
      .poll(async () => (await particleDimensions(page)).count, { timeout: 60_000 })
      .toBeGreaterThan(8)
    const size = await particleDimensions(page)
    expect(size.width).toBeGreaterThanOrEqual(5)
    expect(size.width).toBeLessThanOrEqual(7)
    expect(size.height).toBeGreaterThanOrEqual(5)
    expect(size.height).toBeLessThanOrEqual(7)
  }
  await checkSize()
  const length = page
    .getByRole('region', { name: 'Properties', exact: true })
    .getByRole('group', { name: 'Ray length', exact: true })
    .getByRole('textbox', { name: 'Value' })
  await length.fill('1.2')
  await length.press('Enter')
  await page.waitForTimeout(300)
  await checkSize()
  await preview
    .getByRole('button', { name: 'Zoom preview in', exact: true })
    .click({ clickCount: 3 })
  await page.waitForTimeout(300)
  await checkSize()
})
