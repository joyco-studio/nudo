import { asNodeId } from '@nudo-tsl/core'
import type { NodeId } from '@nudo-tsl/core'
import { beforeEach, describe, expect, it } from 'vitest'

import { useEditorStore } from '@/store/editor-store'
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
  UNTARGETED,
  findCommand,
  invocationFrom,
  panelCommandId,
  placementNear,
} from './command-registry'
import type { CommandServices } from './command-registry'

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

const NO_SERVICES: CommandServices = {
  fitView: () => undefined,
  toggleTheme: () => undefined,
  openShortcutsDialog: () => undefined,
  requestNewGraph: () => undefined,
  openAddNodeMenu: () => undefined,
  addNode: () => null,
  openCommandPalette: () => undefined,
}

function addSine(x: number): NodeId {
  const nodeId = useEditorStore.getState().addNode('math/sin', { x, y: 0 })
  if (nodeId === null) throw new Error('Could not add a Sine node')
  return nodeId
}

function nodeIdsInGraph(): readonly string[] {
  return Object.keys(useEditorStore.getState().graph.nodes)
}

describe('node targets', () => {
  beforeEach(() => {
    useEditorStore.getState().resetGraph()
  })

  it('reads the node from an element inside a canvas node, and none from elsewhere', () => {
    document.body.innerHTML = `
      <div class="react-flow__node" data-id="sine"><input aria-label="In" /></div>
      <button type="button">Elsewhere</button>
    `
    const input = document.querySelector('input')
    const button = document.querySelector('button')
    expect(invocationFrom(input).nodeId).toBe('sine')
    expect(invocationFrom(button)).toEqual({ opener: button, nodeId: null })
    expect(invocationFrom(null)).toEqual(UNTARGETED)
    document.body.innerHTML = ''
  })

  it('acts on the named node only, when the selection does not hold it', () => {
    const selected = addSine(0)
    const named = addSine(300)
    useEditorStore.getState().setSelection([selected])
    findCommand('delete')?.run({ opener: null, nodeId: named, services: NO_SERVICES })
    expect(nodeIdsInGraph()).toContain(selected)
    expect(nodeIdsInGraph()).not.toContain(named)
  })

  it('acts on the whole selection when it holds the named node', () => {
    const first = addSine(0)
    const second = addSine(300)
    useEditorStore.getState().setSelection([first, second])
    findCommand('delete')?.run({ opener: null, nodeId: first, services: NO_SERVICES })
    expect(nodeIdsInGraph()).not.toContain(first)
    expect(nodeIdsInGraph()).not.toContain(second)
  })

  it('places new nodes beside the named node, or in the middle of the view', () => {
    expect(placementNear(asNodeId('sine'))).toEqual({ kind: 'beside-node', nodeId: 'sine' })
    expect(placementNear(null)).toEqual({ kind: 'viewport-center' })
  })
})
