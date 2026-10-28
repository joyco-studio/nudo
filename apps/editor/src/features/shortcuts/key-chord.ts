import type { MessageKey, Translate } from '@/i18n/translate'

/** One way to press a shortcut: the keys held together, in order. */
export type KeyChord = readonly string[]

/** How the catalog, menus and tooltips write Ctrl on Windows and Linux, ⌘ on a Mac. */
export const MOD = 'Ctrl/⌘'

/**
 * Key caps that are words rather than the name printed on the key. Printed names (Enter, Esc,
 * Shift, Delete, Tab, Home…) stay as the keyboard shows them in every language.
 */
const TRANSLATED_KEY_CAPS: Readonly<Record<string, MessageKey>> = {
  Space: 'key.space',
  'Arrow keys': 'key.arrows',
}

/** A key as a key cap shows it in the UI language: "Space" reads "Espacio" in Spanish. */
export function keyCapLabel(key: string, t: Translate): string {
  const messageKey = TRANSLATED_KEY_CAPS[key]
  return messageKey === undefined ? key : t(messageKey)
}

/** A chord as menus print it beside an item: the keys separated by spaces, e.g. "Ctrl/⌘ V". */
export function formatChord(chord: KeyChord, t: Translate): string {
  return chord.map((key) => keyCapLabel(key, t)).join(' ')
}
