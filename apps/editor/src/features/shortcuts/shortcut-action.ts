/** Editor-wide keys. Each one runs the registry command with the same id. */
export const GLOBAL_SHORTCUT_ACTIONS = [
  'undo',
  'redo',
  'copy',
  'paste',
  'select-all',
  'fit-view',
  'tidy-up',
  'show-shortcuts',
  'new-graph',
] as const
export type GlobalShortcutAction = (typeof GLOBAL_SHORTCUT_ACTIONS)[number]

type ShortcutPress = Pick<
  KeyboardEvent,
  'key' | 'code' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey' | 'repeat'
>

const LATIN_LETTER = /^[a-z]$/

/**
 * Ctrl/Cmd + K opens or closes the command palette. The character decides on Latin layouts
 * (Dvorak's K is where QWERTY has V); a layout that types another script falls back to the
 * physical K key. It is not a global shortcut: it also works while typing in a field.
 */
export function isCommandPaletteChord(press: ShortcutPress): boolean {
  const hasCommandModifier = press.ctrlKey || press.metaKey
  if (!hasCommandModifier || press.altKey || press.shiftKey || press.repeat) return false
  const key = press.key.toLowerCase()
  if (key === 'k') return true
  return !LATIN_LETTER.test(key) && press.code === 'KeyK'
}

/**
 * Ctrl/Cmd + Alt + N. Matched on the physical key: on a Mac, Option changes the character `key`
 * reports (a dead key), and plain Ctrl/Cmd + N belongs to the browser.
 */
function isNewGraphChord(press: ShortcutPress): boolean {
  return (
    (press.ctrlKey || press.metaKey) && press.altKey && !press.shiftKey && press.code === 'KeyN'
  )
}

/** Letter shortcuts that need Ctrl (Cmd on a Mac) and no Shift or Alt. */
const COMMAND_ACTIONS: Readonly<Record<string, GlobalShortcutAction>> = {
  c: 'copy',
  v: 'paste',
  a: 'select-all',
}

function commandShortcutAction(press: ShortcutPress): GlobalShortcutAction | null {
  if (press.altKey) return null
  const key = press.key.toLowerCase()
  if (key === 'z') return press.shiftKey ? 'redo' : 'undo'
  if (key === 'y') return press.ctrlKey && !press.shiftKey ? 'redo' : null
  if (press.shiftKey) return null
  return COMMAND_ACTIONS[key] ?? null
}

/** Keys without Ctrl or Cmd: F (with or without Shift) fits the view, Shift+T tidies up. */
function plainShortcutAction(press: ShortcutPress): GlobalShortcutAction | null {
  if (press.key === '?') return 'show-shortcuts'
  const key = press.key.toLowerCase()
  if (key === 'f') return 'fit-view'
  return key === 't' && press.shiftKey ? 'tidy-up' : null
}

/**
 * Maps a key press to an editor-wide shortcut. Only history keeps firing while the key is held;
 * the rest act once. Whether the shortcut may run at all (focus in a field, a dialog open) is the
 * caller's decision.
 */
export function globalShortcutAction(press: ShortcutPress): GlobalShortcutAction | null {
  if (isNewGraphChord(press)) return press.repeat ? null : 'new-graph'
  const hasCommandModifier = press.ctrlKey || press.metaKey
  const action = hasCommandModifier ? commandShortcutAction(press) : plainShortcutAction(press)
  if (action === null || press.altKey) return null
  const isHistory = action === 'undo' || action === 'redo'
  return press.repeat && !isHistory ? null : action
}
