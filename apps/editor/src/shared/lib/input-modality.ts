/** Set on `<html>`: `keyboard` or `pointer`, whichever the person used last. */
export const INPUT_MODALITY_ATTRIBUTE = 'data-input-modality'

const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Shift', 'Control', 'Alt', 'Meta'])

/**
 * Records how the person is driving the editor, so focus styling can tell a keyboard move from a
 * click or from focus that script put back (after a dialog closes, say). Returns the stop.
 */
export function trackInputModality(doc: Document): () => void {
  const root = doc.documentElement
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!MODIFIER_KEYS.has(event.key)) root.setAttribute(INPUT_MODALITY_ATTRIBUTE, 'keyboard')
  }
  const onPointerDown = (): void => {
    root.setAttribute(INPUT_MODALITY_ATTRIBUTE, 'pointer')
  }
  doc.addEventListener('keydown', onKeyDown, { capture: true })
  doc.addEventListener('pointerdown', onPointerDown, { capture: true })
  return () => {
    doc.removeEventListener('keydown', onKeyDown, { capture: true })
    doc.removeEventListener('pointerdown', onPointerDown, { capture: true })
  }
}
