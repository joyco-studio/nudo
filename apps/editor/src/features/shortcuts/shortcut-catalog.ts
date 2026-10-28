import { findCommand } from '@/features/command-palette/command-registry'
import type { CommandId } from '@/features/command-palette/command-registry'
import { commandLabelKey } from '@/features/command-palette/command-text'
import type { MessageKey } from '@/i18n/translate'

import type { KeyChord } from './key-chord'

/**
 * A row of the catalog. A command row takes its words and keys from the command registry. A key
 * row describes a key that acts on whatever has focus (move a node, pan, connect a port): there
 * is no command to run from elsewhere. Words are message keys: the catalog's English source is
 * what the README lists, and the shortcuts dialog shows them in the UI language.
 */
export type CatalogEntry =
  | { readonly kind: 'command'; readonly commandId: CommandId }
  | { readonly kind: 'key'; readonly action: MessageKey; readonly chords: readonly KeyChord[] }

export interface CatalogSection {
  readonly title: MessageKey
  readonly entries: readonly CatalogEntry[]
}

/** A resolved row, as the shortcuts dialog and the README show it. */
export interface ShortcutEntry {
  readonly action: MessageKey
  /** Alternative chords for the same action. */
  readonly chords: readonly KeyChord[]
}

export interface ShortcutSection {
  readonly title: MessageKey
  readonly entries: readonly ShortcutEntry[]
}

function command(commandId: CommandId): CatalogEntry {
  return { kind: 'command', commandId }
}

function key(action: MessageKey, chords: readonly KeyChord[]): CatalogEntry {
  return { kind: 'key', action, chords }
}

/** Every keyboard shortcut in the editor, by where it works. */
export const SHORTCUT_CATALOG: readonly CatalogSection[] = [
  {
    title: 'shortcuts.section.anywhere',
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
      key('shortcuts.key.focusNotifications', [['Alt', 'T']]),
    ],
  },
  {
    title: 'shortcuts.section.panels',
    entries: [
      command('toggle-blackboard'),
      command('toggle-inspector'),
      command('toggle-preview'),
      command('toggle-code'),
      command('cycle-preview-layout'),
    ],
  },
  {
    title: 'shortcuts.section.previewLayout',
    entries: [
      key('shortcuts.key.leaveFullPreview', [['Esc']]),
      key('shortcuts.key.moveSplit', [['Arrow keys']]),
      key('shortcuts.key.splitExtremes', [['Home'], ['End']]),
    ],
  },
  {
    title: 'shortcuts.section.notifications',
    entries: [
      key('shortcuts.key.notificationMove', [['Tab'], ['Shift', 'Tab']]),
      key('shortcuts.key.notificationClose', [['Esc']]),
    ],
  },
  {
    title: 'shortcuts.section.canvas',
    entries: [
      command('add-node'),
      key('shortcuts.key.panSmall', [['Arrow keys']]),
      key('shortcuts.key.panLarge', [['Shift', 'Arrow keys']]),
      key('shortcuts.key.deleteSelection', [['Delete']]),
      key('shortcuts.key.canvasMenu', [['Shift', 'F10'], ['Menu']]),
    ],
  },
  {
    title: 'shortcuts.section.node',
    entries: [
      key('shortcuts.key.moveNodeSmall', [['Arrow keys']]),
      key('shortcuts.key.moveNodeLarge', [['Shift', 'Arrow keys']]),
      key('shortcuts.key.deleteNode', [['Delete'], ['Backspace']]),
      key('shortcuts.key.editFirstField', [['Enter']]),
      key('shortcuts.key.leaveField', [['Esc']]),
      key('shortcuts.key.nextPort', [['Tab'], ['Shift', 'Tab']]),
      key('shortcuts.key.nodeMenu', [['Shift', 'F10'], ['Menu']]),
    ],
  },
  {
    title: 'shortcuts.section.comment',
    entries: [
      key('shortcuts.key.commentNote', [['Enter']]),
      key('shortcuts.key.commentTitle', [['Tab']]),
      key('shortcuts.key.commentResize', [['Alt', 'Arrow keys']]),
    ],
  },
  {
    title: 'shortcuts.section.port',
    entries: [
      key('shortcuts.key.portConnect', [['Enter']]),
      key('shortcuts.key.portDisconnect', [['Delete']]),
    ],
  },
  {
    title: 'shortcuts.section.connection',
    entries: [
      key('shortcuts.key.connectionDelete', [['Delete']]),
      key('shortcuts.key.connectionMenu', [['Shift', 'F10'], ['Menu']]),
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
  return [{ action: commandLabelKey(found.id), chords: found.shortcut }]
}

/** The catalog with every command row resolved, for the shortcuts dialog. */
export const SHORTCUT_SECTIONS: readonly ShortcutSection[] = SHORTCUT_CATALOG.map((section) => ({
  title: section.title,
  entries: section.entries.flatMap(resolveEntry),
}))
