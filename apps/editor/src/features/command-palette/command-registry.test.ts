import { describe, expect, it } from 'vitest'

import { PANEL_IDS } from '@/features/panels/panel-state'
import { PANEL_SHORTCUT_KEYS } from '@/features/panels/panel-shortcut-action'
import {
  SHORTCUT_CATALOG,
  SHORTCUT_SECTIONS,
  catalogCommandIds,
} from '@/features/shortcuts/shortcut-catalog'
import { GLOBAL_SHORTCUT_ACTIONS } from '@/features/shortcuts/shortcut-action'

import {
  COMMANDS,
  PALETTE_COMMANDS,
  findCommand,
  panelCommandId,
  searchCommands,
} from './command-registry'

function idsOf(commands: readonly { readonly id: string }[]): readonly string[] {
  return commands.map((command) => command.id)
}

describe('command registry', () => {
  it('registry ids unique', () => {
    const ids = idsOf(COMMANDS)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every catalog shortcut has a command', () => {
    for (const id of catalogCommandIds(SHORTCUT_CATALOG)) {
      const command = findCommand(id)
      expect(command, id).toBeDefined()
      expect(command?.shortcut.length, id).toBeGreaterThan(0)
    }
  })

  it('lists every command that has a shortcut in the catalog', () => {
    const listed = new Set(catalogCommandIds(SHORTCUT_CATALOG))
    const withShortcut = COMMANDS.filter((command) => command.shortcut.length > 0)
    expect(withShortcut.length).toBeGreaterThan(0)
    for (const command of withShortcut) expect(listed.has(command.id), command.id).toBe(true)
  })

  it('derives catalog rows from the commands: same chords, the command label by default', () => {
    const rows = SHORTCUT_SECTIONS.flatMap((section) => section.entries)
    const undo = findCommand('undo')
    expect(rows).toContainEqual({ action: undo?.label, chords: undo?.shortcut })
    const layout = findCommand('cycle-preview-layout')
    expect(rows).toContainEqual({ action: layout?.label, chords: [['Shift', 'P']] })
  })

  it('backs every editor-wide key with a command that shows it', () => {
    for (const action of GLOBAL_SHORTCUT_ACTIONS) {
      expect(findCommand(action)?.shortcut.length, action).toBeGreaterThan(0)
    }
  })

  it('backs every panel letter with the command that shows the same letter', () => {
    for (const panel of PANEL_IDS) {
      const command = findCommand(panelCommandId({ kind: 'toggle', panel }))
      expect(command?.shortcut).toEqual([[PANEL_SHORTCUT_KEYS[panel]]])
    }
    expect(findCommand(panelCommandId({ kind: 'cycle-layout' }))?.shortcut).toEqual([
      ['Shift', 'P'],
    ])
  })

  it('keeps the palette command itself out of the palette', () => {
    expect(idsOf(PALETTE_COMMANDS)).not.toContain('open-command-palette')
    expect(idsOf(PALETTE_COMMANDS)).toContain('toggle-theme')
  })
})

describe('searchCommands', () => {
  it('lists every palette command for an empty query', () => {
    expect(idsOf(searchCommands(PALETTE_COMMANDS, '  '))).toEqual(idsOf(PALETTE_COMMANDS))
  })

  it('puts the split layout first for "split"', () => {
    expect(idsOf(searchCommands(PALETTE_COMMANDS, 'split'))[0]).toBe('preview-split')
  })

  it('matches keywords and every word of the query, ignoring case', () => {
    expect(idsOf(searchCommands(PALETTE_COMMANDS, 'DARK'))).toEqual(['toggle-theme'])
    expect(idsOf(searchCommands(PALETTE_COMMANDS, 'hide code'))).toEqual(['toggle-code'])
  })

  it('matches the start of words, not the middle, and ignores punctuation', () => {
    expect(searchCommands(PALETTE_COMMANDS, 'ide')).toEqual([])
    expect(idsOf(searchCommands(PALETTE_COMMANDS, 'layout: full'))[0]).toBe('preview-full')
  })

  it('returns nothing when no command matches', () => {
    expect(searchCommands(PALETTE_COMMANDS, 'zzz-no-such-command')).toEqual([])
  })
})
