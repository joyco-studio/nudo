/** One way to press a shortcut: the keys held together, in order. */
export type KeyChord = readonly string[]

/** How the catalog, menus and tooltips write Ctrl on Windows and Linux, ⌘ on a Mac. */
export const MOD = 'Ctrl/⌘'

/** A chord as menus print it beside an item: the keys separated by spaces, e.g. "Ctrl/⌘ V". */
export function formatChord(chord: KeyChord): string {
  return chord.join(' ')
}
