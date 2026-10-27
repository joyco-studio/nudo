/** Set on `<html>`: `keyboard` or `pointer`, whichever the person used last. */
export const INPUT_MODALITY_ATTRIBUTE = 'data-input-modality'

const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Shift', 'Control', 'Alt', 'Meta'])

/** True while the last key or pointer press was a key: what just happened came from the keyboard. */
export function isKeyboardModality(doc: Document): boolean {
  return doc.documentElement.getAttribute(INPUT_MODALITY_ATTRIBUTE) === 'keyboard'
}

/**
 * Records how the person is driving the editor, so focus styling can tell a keyboard move from a
 * click or from focus that script put back (after a dialog closes, say), and motion can stay still
 * for whatever a key started. Returns the stop.
 *
 * Listens on the window in the capture phase, the first stop of every event: call it before any
 * shortcut listens there, so a shortcut that stops its key (Space for the add-node menu) still
 * runs with the modality recorded.
 */
export function trackInputModality(doc: Document): () => void {
  const root = doc.documentElement
  const target: EventTarget = doc.defaultView ?? doc
  const onKeyDown = (event: Event): void => {
    if (event instanceof KeyboardEvent && !MODIFIER_KEYS.has(event.key)) {
      root.setAttribute(INPUT_MODALITY_ATTRIBUTE, 'keyboard')
    }
  }
  const onPointerDown = (event: Event): void => {
    // A real press always has a pointer type. Script fires presses without one (the overlay
    // coordinator dismissing a menu, motion/react's tap gesture on Enter). Those don't change the
    // modality.
    if ('pointerType' in event && event.pointerType === '') return
    root.setAttribute(INPUT_MODALITY_ATTRIBUTE, 'pointer')
  }
  target.addEventListener('keydown', onKeyDown, { capture: true })
  target.addEventListener('pointerdown', onPointerDown, { capture: true })
  return () => {
    target.removeEventListener('keydown', onKeyDown, { capture: true })
    target.removeEventListener('pointerdown', onPointerDown, { capture: true })
  }
}
