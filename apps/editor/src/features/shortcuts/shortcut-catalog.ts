import { findCommand } from '@/features/command-palette/command-registry'
import type { CommandId } from '@/features/command-palette/command-registry'

import type { KeyChord } from './key-chord'

/**
 * A row of the catalog. A command row takes its words and keys from the command registry. A key
 * row describes a key that acts on whatever has focus (move a node, pan, connect a port): there
 * is no command to run from elsewhere.
 */
export type CatalogEntry =
  | { readonly kind: 'command'; readonly commandId: CommandId }
  | { readonly kind: 'key'; readonly action: string; readonly chords: readonly KeyChord[] }

export interface CatalogSection {
  readonly title: string
  readonly entries: readonly CatalogEntry[]
}

/** A resolved row, as the shortcuts dialog and the README show it. */
export interface ShortcutEntry {
  readonly action: string
  /** Alternative chords for the same action. */
  readonly chords: readonly KeyChord[]
}

export interface ShortcutSection {
  readonly title: string
  readonly entries: readonly ShortcutEntry[]
}

function command(commandId: CommandId): CatalogEntry {
  return { kind: 'command', commandId }
}

function key(action: string, chords: readonly KeyChord[]): CatalogEntry {
  return { kind: 'key', action, chords }
}

/** Every keyboard shortcut in the editor, by where it works. */
export const SHORTCUT_CATALOG: readonly CatalogSection[] = [
  {
    title: 'Anywhere',
    entries: [
      command('undo'),
      command('redo'),
      command('copy'),
      command('paste'),
      command('select-all'),
      command('fit-view'),
      command('new-graph'),
      command('open-command-palette'),
      command('show-shortcuts'),
      key('Move focus to the notifications', [['Alt', 'T']]),
    ],
  },
  {
    title: 'Panels (canvas, node or panel header)',
    entries: [
      command('toggle-blackboard'),
      command('toggle-inspector'),
      command('toggle-preview'),
      command('toggle-code'),
      command('cycle-preview-layout'),
    ],
  },
  {
    title: 'Preview layout',
    entries: [
      key('Leave the full preview', [['Esc']]),
      key('Move the split handle 5%', [['Arrow keys']]),
      key('Smallest or largest canvas in split', [['Home'], ['End']]),
    ],
  },
  {
    title: 'Notifications',
    entries: [
      key('Move between the notification and its button', [['Tab'], ['Shift', 'Tab']]),
      key('Close the notifications and return', [['Esc']]),
    ],
  },
  {
    title: 'Canvas',
    entries: [
      command('add-node'),
      key('Pan the view 40 px', [['Arrow keys']]),
      key('Pan the view 160 px', [['Shift', 'Arrow keys']]),
      key('Delete the selected nodes and connections', [['Delete']]),
      key('Open the canvas menu', [['Shift', 'F10'], ['Menu']]),
    ],
  },
  {
    title: 'Node',
    entries: [
      key('Move the node 10 px', [['Arrow keys']]),
      key('Move the node 50 px', [['Shift', 'Arrow keys']]),
      key('Delete the node', [['Delete'], ['Backspace']]),
      key('Edit its first field', [['Enter']]),
      key('Leave a field and return to the node', [['Esc']]),
      key('Next or previous port and field', [['Tab'], ['Shift', 'Tab']]),
      key('Open its menu: copy, duplicate, preview mode, delete', [['Shift', 'F10'], ['Menu']]),
    ],
  },
  {
    title: 'Comment',
    entries: [
      key('Edit its title', [['Enter']]),
      key('Resize the frame 20 px', [['Alt', 'Arrow keys']]),
    ],
  },
  {
    title: 'Port',
    entries: [
      key('Connect to another port', [['Enter']]),
      key('Remove its connections', [['Delete']]),
    ],
  },
  {
    title: 'Connection',
    entries: [
      key('Delete the connection', [['Delete']]),
      key('Open its menu', [['Shift', 'F10'], ['Menu']]),
    ],
  },
]

/** The commands the catalog lists, in catalog order. */
export function catalogCommandIds(catalog: readonly CatalogSection[]): readonly CommandId[] {
  return catalog.flatMap((section) =>
    section.entries.flatMap((entry) => (entry.kind === 'command' ? [entry.commandId] : [])),
  )
}

function resolveEntry(entry: CatalogEntry): readonly ShortcutEntry[] {
  if (entry.kind === 'key') return [{ action: entry.action, chords: entry.chords }]
  const found = findCommand(entry.commandId)
  // The registry test keeps every listed command present; a missing one would just drop its row.
  if (found === undefined) return []
  return [{ action: found.label, chords: found.shortcut }]
}

/** The catalog with every command row resolved, for the shortcuts dialog. */
export const SHORTCUT_SECTIONS: readonly ShortcutSection[] = SHORTCUT_CATALOG.map((section) => ({
  title: section.title,
  entries: section.entries.flatMap(resolveEntry),
}))
