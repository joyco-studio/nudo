export type GlobalShortcutAction =
  'undo' | 'redo' | 'copy' | 'paste' | 'select-all' | 'fit-view' | 'show-shortcuts'

type ShortcutPress = Pick<
  KeyboardEvent,
  'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey' | 'repeat'
>

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

function plainShortcutAction(press: ShortcutPress): GlobalShortcutAction | null {
  if (press.key === '?') return 'show-shortcuts'
  return press.key.toLowerCase() === 'f' ? 'fit-view' : null
}

/**
 * Maps a key press to an editor-wide shortcut. Only history keeps firing while the key is held;
 * the rest act once. Whether the shortcut may run at all (focus in a field, a dialog open) is the
 * caller's decision.
 */
export function globalShortcutAction(press: ShortcutPress): GlobalShortcutAction | null {
  const hasCommandModifier = press.ctrlKey || press.metaKey
  const action = hasCommandModifier ? commandShortcutAction(press) : plainShortcutAction(press)
  if (action === null || press.altKey) return null
  const isHistory = action === 'undo' || action === 'redo'
  return press.repeat && !isHistory ? null : action
}
