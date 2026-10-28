import { expect, test, type Locator, type Page } from '@playwright/test'

import { waitForAutosave } from './support/pending-work'
import { readStoredNodes } from './support/read-autosave'
import { graphDocument, seedAutosave, seedAutosaveOnce } from './support/seed-graph'

const NOTE_ID = 'note'
const NOTE = graphDocument(
  [
    {
      id: NOTE_ID,
      type: 'utility/comment',
      position: { x: 0, y: 0 },
      params: { title: 'Waves', body: 'Saved note' },
    },
  ],
  [],
)
/** Pixels the pointer travels in the drag tests: far past React Flow's drag threshold. */
const DRAG_DISTANCE_PX = 80
const WHEEL_DELTA_PX = 120
/** Enough lines to overflow the default 200 px frame. */
const LONG_NOTE_LINES = 30

function frame(page: Page): Locator {
  return page.getByRole('group', { name: 'Waves', exact: true })
}

function noteBody(page: Page): Locator {
  return frame(page).getByRole('textbox', { name: 'Comment text' })
}

async function storedBody(page: Page): Promise<unknown> {
  const node = (await readStoredNodes(page)).find((stored) => stored.id === NOTE_ID)
  return node?.params.body
}

async function storedPosition(page: Page): Promise<unknown> {
  const node = (await readStoredNodes(page)).find((stored) => stored.id === NOTE_ID)
  return node?.position
}

async function boxOf(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('Element has no bounding box')
  return box
}

async function dragBy(page: Page, from: { x: number; y: number }, distance: number): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + distance, from.y + distance, { steps: 8 })
  await page.mouse.up()
}

test.describe('comment body text', () => {
  test('one undo removes a whole multi-line edit, and the note survives a reload', async ({
    page,
  }) => {
    await seedAutosaveOnce(page, NOTE)
    await page.goto('/')
    const body = noteBody(page)
    await expect(body).toHaveValue('Saved note')
    await expect(body).toHaveAttribute('placeholder', 'Write a note…')

    await body.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Foam line')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Tune later')
    await expect(body).toHaveValue('Foam line\nTune later')
    // Nothing is committed while the edit session is open.
    expect(await storedBody(page)).toBe('Saved note')

    await page.keyboard.press('Tab')
    await expect(body).not.toBeFocused()
    await expect.poll(async () => storedBody(page)).toBe('Foam line\nTune later')

    // Undo history lives in the page, so check it before the reload.
    await page.getByRole('main', { name: 'Node canvas' }).focus()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(body).toHaveValue('Saved note')
    await expect.poll(async () => storedBody(page)).toBe('Saved note')
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(body).toHaveValue('Foam line\nTune later')
    await expect.poll(async () => storedBody(page)).toBe('Foam line\nTune later')

    await page.reload()
    await expect(noteBody(page)).toHaveValue('Foam line\nTune later')
  })

  test.describe('with a seeded note', () => {
    test.beforeEach(async ({ page }) => {
      await seedAutosave(page, NOTE)
      await page.goto('/')
      await expect(noteBody(page)).toHaveValue('Saved note')
    })

    test('Escape reverts an edit in progress and returns focus to the frame', async ({ page }) => {
      const body = noteBody(page)
      await body.click()
      await page.keyboard.press('ControlOrMeta+a')
      await page.keyboard.type('Discarded')
      await page.keyboard.press('Escape')

      await expect(body).toHaveValue('Saved note')
      await expect(frame(page)).toBeFocused()
      await waitForAutosave(page)
      expect(await storedBody(page)).toBe('Saved note')
    })

    test('Enter on the frame starts writing, and canvas keys type instead of acting', async ({
      page,
    }) => {
      await frame(page).focus()
      await page.keyboard.press('Enter')
      const body = noteBody(page)
      await expect(body).toBeFocused()

      // The caret starts at the end of the note.
      // Backspace, Delete, Space and the panel letters all stay in the field.
      await page.keyboard.press('Backspace')
      await page.keyboard.press('Delete')
      await page.keyboard.type(' bipc')
      await expect(body).toHaveValue('Saved not bipc')
      await expect(frame(page)).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Code panel', exact: true })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
      await expect(
        page.getByRole('button', { name: 'Inspector panel', exact: true }),
      ).toHaveAttribute('aria-expanded', 'true')
    })

    test('dragging inside the text selects it instead of moving the frame', async ({ page }) => {
      const body = noteBody(page)
      const positionBefore = await frame(page).boundingBox()
      const bodyBox = await boxOf(body)

      // Start inside the first word: at 100% zoom, Chromium drops the anchor of a drag that
      // starts on the boundary between the first two glyphs (12px in).
      await dragBy(page, { x: bodyBox.x + 24, y: bodyBox.y + 12 }, DRAG_DISTANCE_PX)

      expect(await frame(page).boundingBox()).toEqual(positionBefore)
      const selected = await body.evaluate((element) =>
        element instanceof HTMLTextAreaElement ? element.selectionEnd - element.selectionStart : 0,
      )
      expect(selected).toBeGreaterThan(0)
    })

    test('the frame still drags from its header', async ({ page }) => {
      const header = await boxOf(frame(page).locator('header'))
      const title = await boxOf(frame(page).getByRole('textbox', { name: 'Comment title' }))
      // The header beyond the title is the drag handle.
      expect(title.x + title.width).toBeLessThan(header.x + header.width)

      await dragBy(
        page,
        { x: header.x + header.width - 8, y: header.y + header.height / 2 },
        DRAG_DISTANCE_PX,
      )

      await expect.poll(async () => storedPosition(page)).not.toEqual({ x: 0, y: 0 })
    })

    test('the wheel scrolls a long note, and zooms the canvas over a short one', async ({
      page,
    }) => {
      const body = noteBody(page)
      const viewport = page.locator('.react-flow__viewport')
      const bodyBox = await boxOf(body)
      const center = { x: bodyBox.x + bodyBox.width / 2, y: bodyBox.y + bodyBox.height / 2 }

      const transformBefore = await viewport.getAttribute('style')
      await page.mouse.move(center.x, center.y)
      await page.mouse.wheel(0, WHEEL_DELTA_PX)
      await expect.poll(async () => viewport.getAttribute('style')).not.toBe(transformBefore)

      await body.click()
      await page.keyboard.type(Array.from({ length: LONG_NOTE_LINES }, () => 'line').join('\n'))
      await page.keyboard.press('Tab')
      await body.evaluate((element) => {
        element.scrollTop = 0
      })
      const zoomedTransform = await viewport.getAttribute('style')
      const longBox = await boxOf(body)
      await page.mouse.move(longBox.x + longBox.width / 2, longBox.y + longBox.height / 2)
      await page.mouse.wheel(0, WHEEL_DELTA_PX)

      await expect
        .poll(async () => body.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0)
      expect(await viewport.getAttribute('style')).toBe(zoomedTransform)
    })
  })
})
