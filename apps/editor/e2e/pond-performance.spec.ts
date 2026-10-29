import { expect, test, type JSHandle, type Page } from '@playwright/test'

import { openPond } from './support/open-pond'
import { stillTransforms } from './support/still-transforms'

/** What the main thread spent while an interaction ran. */
interface FrameCost {
  /** Animation frames the page painted. */
  readonly frames: number
  /** Long tasks (over 50 ms each) the browser reported. */
  readonly longTasks: number
  /** Their summed duration, in ms. */
  readonly longTaskMs: number
  /** Node view renders (cards, comment frames, reroutes): see `node-render-stats`. */
  readonly nodeRenders: number
}

interface FrameCostRecorder {
  stop(): FrameCost
}

/** About one second of pointer moves, one per frame. */
const DRAG_FRAMES = 60
/**
 * Renders the dev-only counter sees for one render of a node view: development builds run under
 * React StrictMode, which calls every render function twice.
 */
const COUNTED_RENDERS_PER_RENDER = 2

/**
 * The budgets. Re-rendering every node on every frame, a one-second drag across the pond (162 nodes
 * then, 119 since it was slimmed down) rendered node views about 19,000 times with some 20 s of long tasks (one worker), and the glide
 * about 1,500 times. Now a node that only moves is not rendered again: the drag may render at most
 * the dragged node once a frame, and the glide only the nodes it moves, each once (the tidied graph
 * it commits); a node the glide leaves in place is not rendered at all.
 * The long-task budgets are loose on purpose: the software-rendered WebGL previews and the other
 * specs running alongside add their own long tasks, so these only catch the per-frame regression
 * (the render budgets are the precise guard).
 */
const MAX_DRAG_RENDERS = DRAG_FRAMES
const MAX_DRAG_LONG_TASK_MS = 8000
const MAX_GLIDE_LONG_TASK_MS = 4000

/** Starts counting frames, long tasks and node renders; `stop` returns what ran since. */
async function startFrameCost(page: Page): Promise<JSHandle<FrameCostRecorder>> {
  return page.evaluateHandle(() => {
    const longTaskDurations: number[] = []
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTaskDurations.push(entry.duration)
    })
    observer.observe({ type: 'longtask' })
    const rendersBefore = window.__nudoNodeRenderCount ?? 0
    let frames = 0
    let isRunning = true
    const countFrame = (): void => {
      if (!isRunning) return
      frames += 1
      requestAnimationFrame(countFrame)
    }
    requestAnimationFrame(countFrame)
    return {
      stop: (): FrameCost => {
        isRunning = false
        for (const entry of observer.takeRecords()) longTaskDurations.push(entry.duration)
        observer.disconnect()
        return {
          frames,
          longTasks: longTaskDurations.length,
          longTaskMs: Math.round(longTaskDurations.reduce((sum, duration) => sum + duration, 0)),
          nodeRenders: (window.__nudoNodeRenderCount ?? 0) - rendersBefore,
        }
      },
    }
  })
}

async function stopFrameCost(recorder: JSHandle<FrameCostRecorder>): Promise<FrameCost> {
  return recorder.evaluate((handle) => handle.stop())
}

async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve()
        })
      }),
  )
}

interface DragTarget {
  readonly id: string
  /** Where the drag starts: the middle of the node's header, in page pixels. */
  readonly x: number
  readonly y: number
  /** How far down (or up, when negative) the drag goes to carry the node off its comment frame. */
  readonly offsetY: number
}

/** Room between a dragged node and the frame it leaves, and between the pointer and the canvas edge. */
const CLEARANCE_PX = 12

/**
 * The node card nearest the middle of the canvas whose header is not covered (panels float over
 * the pond's edges) and which a vertical drag can carry off its comment frame within the canvas.
 * Off its frame, the node is a block of its own, so Tidy up has the layout to redo.
 */
async function centralDragTarget(page: Page): Promise<DragTarget> {
  const target = await page.evaluate((clearance) => {
    const canvas = document.querySelector('.react-flow')
    if (canvas === null) return null
    const area = canvas.getBoundingClientRect()
    const middle = { x: area.left + area.width / 2, y: area.top + area.height / 2 }
    const frames = [...document.querySelectorAll('.react-flow__node-comment')].map((frame) =>
      frame.getBoundingClientRect(),
    )
    const isInside = (y: number): boolean => y > area.top + clearance && y < area.bottom - clearance
    const candidates = [...document.querySelectorAll('.react-flow__node-graph-node')].flatMap(
      (node) => {
        const header = node.querySelector('header')
        const id = node.getAttribute('data-id')
        if (header === null || id === null) return []
        const box = node.getBoundingClientRect()
        const headerBox = header.getBoundingClientRect()
        const x = headerBox.left + headerBox.width / 2
        const y = headerBox.top + headerBox.height / 2
        if (!header.contains(document.elementFromPoint(x, y))) return []
        const centerX = box.left + box.width / 2
        const centerY = box.top + box.height / 2
        const frame = frames
          .filter(
            (rect) =>
              centerX >= rect.left &&
              centerX <= rect.right &&
              centerY >= rect.top &&
              centerY <= rect.bottom,
          )
          .sort((a, b) => b.width * b.height - a.width * a.height)[0]
        if (frame === undefined) return []
        const offsets = [
          frame.bottom + box.height / 2 + clearance - centerY,
          frame.top - box.height / 2 - clearance - centerY,
        ].filter((offset) => isInside(y + offset))
        const [offsetY] = offsets.sort((a, b) => Math.abs(a) - Math.abs(b))
        return offsetY === undefined ? [] : [{ id, x, y, offsetY }]
      },
    )
    const distance = (point: { x: number; y: number }): number =>
      Math.hypot(point.x - middle.x, point.y - middle.y)
    return candidates.sort((a, b) => distance(a) - distance(b))[0] ?? null
  }, CLEARANCE_PX)
  if (target === null) throw new Error('No node on the canvas can be dragged off its frame')
  return target
}

/** Every node's transform, by id: what moved between two readings. */
async function nodeTransforms(page: Page): Promise<Readonly<Record<string, string>>> {
  return page
    .locator('.react-flow__node')
    .evaluateAll((nodes) =>
      Object.fromEntries(
        nodes.map((node) => [node.getAttribute('data-id') ?? '', getComputedStyle(node).transform]),
      ),
    )
}

async function nodeTransform(page: Page, id: string): Promise<string> {
  return page
    .locator(`.react-flow__node[data-id="${id}"]`)
    .evaluate((node) => getComputedStyle(node).transform)
}

/** Resolves once the view and the node `id` have held still for a few frames. */
async function waitUntilStill(page: Page, id: string): Promise<void> {
  await stillTransforms(page, ['.react-flow__viewport', `.react-flow__node[data-id="${id}"]`])
}

test.describe('pond frame budget', () => {
  test.setTimeout(120_000)

  test('dragging a node and gliding into a tidy layout re-render only what moves', async ({
    page,
  }) => {
    await openPond(page)
    await waitUntilStill(page, 'master')

    // What the page spends doing nothing, for reading the numbers below (previews keep rendering).
    const idleRecorder = await startFrameCost(page)
    for (let step = 1; step <= DRAG_FRAMES; step += 1) await nextFrame(page)
    const idle = await stopFrameCost(idleRecorder)

    const target = await centralDragTarget(page)
    const beforeDrag = await nodeTransform(page, target.id)
    await page.mouse.move(target.x, target.y)
    await page.mouse.down()
    const dragRecorder = await startFrameCost(page)
    for (let step = 1; step <= DRAG_FRAMES; step += 1) {
      await page.mouse.move(target.x, target.y + (target.offsetY * step) / DRAG_FRAMES)
      await nextFrame(page)
    }
    const drag = await stopFrameCost(dragRecorder)
    await page.mouse.up()
    await waitUntilStill(page, target.id)
    // The drag did move the node: the budget below is not met by doing nothing.
    const afterDrag = await nodeTransform(page, target.id)
    expect(afterDrag).not.toBe(beforeDrag)

    // A click on the canvas menu's item: a pointer start, so the nodes glide.
    await page.getByRole('main', { name: 'Node canvas' }).focus()
    await page.keyboard.press('Shift+F10')
    const tidyItem = page.getByRole('menuitem', { name: 'Tidy up graph' })
    await expect(tidyItem).toBeVisible()
    const beforeGlide = await nodeTransforms(page)
    const glideRecorder = await startFrameCost(page)
    await tidyItem.click()
    await waitUntilStill(page, target.id)
    const glide = await stopFrameCost(glideRecorder)
    // The dragged node left the layout, so tidying moved it back into place.
    expect(await nodeTransform(page, target.id)).not.toBe(afterDrag)
    const afterGlide = await nodeTransforms(page)
    const movedCount = Object.entries(afterGlide).filter(
      ([id, transform]) => beforeGlide[id] !== transform,
    ).length

    test
      .info()
      .annotations.push(
        { type: 'idle', description: JSON.stringify(idle) },
        { type: 'drag', description: JSON.stringify(drag) },
        { type: 'glide', description: JSON.stringify({ ...glide, movedNodes: movedCount }) },
      )

    expect(drag.nodeRenders).toBeLessThanOrEqual(MAX_DRAG_RENDERS)
    expect(glide.nodeRenders).toBeLessThanOrEqual(COUNTED_RENDERS_PER_RENDER * movedCount)
    expect(drag.longTaskMs).toBeLessThanOrEqual(MAX_DRAG_LONG_TASK_MS)
    expect(glide.longTaskMs).toBeLessThanOrEqual(MAX_GLIDE_LONG_TASK_MS)
  })
})
