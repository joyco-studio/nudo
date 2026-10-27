import { MASTER_NODE_ID } from '@nudo-tsl/core'
import type { NodeId, NodeTypeId } from '@nudo-tsl/core'

import type { PlacementOrigin } from '@/features/add-node-menu/add-node-placement'
import { flowNodeIdOf, resolveActionNodeIds } from '@/features/canvas/canvas-keyboard-model'
import { focusFlowNode } from '@/features/canvas/focus-flow-node'
import { duplicateNodes, selectAllNodes } from '@/features/canvas/node-commands'
import { COMMENT_TYPE } from '@/features/canvas/to-flow'
import { PANEL_SHORTCUT_KEYS } from '@/features/panels/panel-shortcut-action'
import type { PanelShortcutAction } from '@/features/panels/panel-shortcut-action'
import type { PanelId, PreviewLayout } from '@/features/panels/panel-state'
import { copySelection, pasteFromClipboard } from '@/features/shortcuts/clipboard'
import { MOD } from '@/features/shortcuts/key-chord'
import type { KeyChord } from '@/features/shortcuts/key-chord'
import type { GlobalShortcutAction } from '@/features/shortcuts/shortcut-action'
import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'
import { redo, undo, useEditorStore } from '@/store/editor-store'

/** The palette's command groups, in palette order. Nodes are listed by the palette itself. */
export type CommandGroupId = 'actions' | 'view'

type PanelCommandId = `toggle-${PanelId}`
type LayoutCommandId = `preview-${PreviewLayout}`

export type CommandId =
  | GlobalShortcutAction
  | PanelCommandId
  | LayoutCommandId
  | 'duplicate'
  | 'delete'
  | 'add-node'
  | 'add-comment'
  | 'cycle-preview-layout'
  | 'toggle-theme'
  | 'open-command-palette'

/** What commands need from the React tree: the view, the theme and the editor's dialogs. */
export interface CommandServices {
  fitView: () => void
  toggleTheme: () => void
  openShortcutsDialog: (opener: HTMLElement | null) => void
  requestNewGraph: (opener: HTMLElement | null) => void
  openAddNodeMenu: (origin: PlacementOrigin, opener: HTMLElement | null) => void
  /** Adds and selects a node near the origin, clear of other nodes. Null when it can't be added. */
  addNode: (type: NodeTypeId, origin: PlacementOrigin) => NodeId | null
  openCommandPalette: (opener: HTMLElement | null) => void
}

export interface CommandContext {
  /**
   * The element that had focus when the command was asked for: a key's target, the palette's
   * opener or a context menu's node. Node commands act on its node (or the selection holding
   * it), and a dialog the command opens gives focus back to it.
   */
  readonly opener: HTMLElement | null
  readonly services: CommandServices
}

export interface Command {
  readonly id: CommandId
  readonly group: CommandGroupId
  /** The name in the palette and the shortcuts catalog. */
  readonly label: string
  /** A shorter name for a context menu, whose target already says what the command acts on. */
  readonly menuLabel?: string
  /** Other words people search for. */
  readonly keywords: readonly string[]
  /** Alternative chords that run the command; empty when no key does. */
  readonly shortcut: readonly KeyChord[]
  /** False while there is nothing to act on; the palette leaves the command out then. */
  readonly isAvailable?: (opener: HTMLElement | null) => boolean
  readonly run: (context: CommandContext) => void
}

const getStore = () => useEditorStore.getState()

/** The nodes a node command applies to: the opener's node, or the selection when it holds it. */
function nodeTargets(opener: HTMLElement | null): readonly NodeId[] {
  return resolveActionNodeIds(flowNodeIdOf(opener), getStore().selectedNodeIds)
}

/** The master can't be copied, duplicated or deleted, so it alone gives such commands nothing. */
function hasRemovableTargets(opener: HTMLElement | null): boolean {
  return nodeTargets(opener).some((id) => id !== MASTER_NODE_ID)
}

/** New nodes land beside the opener's node, or in the middle of the view. */
export function placementNear(opener: HTMLElement | null): PlacementOrigin {
  const nodeId = flowNodeIdOf(opener)
  return nodeId === null ? { kind: 'viewport-center' } : { kind: 'beside-node', nodeId }
}

const PANEL_NAMES: Readonly<Record<PanelId, string>> = {
  blackboard: 'the Properties panel',
  inspector: 'the Inspector',
  preview: 'the Preview',
  code: 'the Code panel',
}

const PANEL_KEYWORDS: Readonly<Record<PanelId, readonly string[]>> = {
  blackboard: ['blackboard', 'uniforms', 'sidebar'],
  inspector: ['details', 'selected node'],
  preview: ['viewport', 'render', 'material'],
  code: ['tsl', 'generated', 'export'],
}

function panelCommand(panel: PanelId): Command {
  return {
    id: `toggle-${panel}`,
    group: 'view',
    label: `Show or hide ${PANEL_NAMES[panel]}`,
    keywords: ['toggle', 'panel', ...PANEL_KEYWORDS[panel]],
    shortcut: [[PANEL_SHORTCUT_KEYS[panel]]],
    run: () => {
      getStore().togglePanel(panel)
    },
  }
}

const LAYOUT_NAMES: Readonly<Record<PreviewLayout, string>> = {
  docked: 'Docked',
  split: 'Split',
  full: 'Full',
}

const LAYOUT_KEYWORDS: Readonly<Record<PreviewLayout, readonly string[]>> = {
  docked: ['dock', 'floating', 'corner'],
  split: ['side by side', 'columns'],
  full: ['fullscreen', 'maximize', 'expand'],
}

function layoutCommand(layout: PreviewLayout): Command {
  return {
    id: `preview-${layout}`,
    group: 'view',
    label: `Preview layout: ${LAYOUT_NAMES[layout]}`,
    keywords: ['preview', ...LAYOUT_KEYWORDS[layout]],
    shortcut: [],
    run: () => {
      getStore().setPreviewLayout(layout)
    },
  }
}

const ACTION_COMMANDS: readonly Command[] = [
  {
    id: 'undo',
    group: 'actions',
    label: 'Undo',
    keywords: ['history', 'revert', 'back'],
    shortcut: [[MOD, 'Z']],
    isAvailable: () => useEditorStore.temporal.getState().pastStates.length > 0,
    run: undo,
  },
  {
    id: 'redo',
    group: 'actions',
    label: 'Redo',
    keywords: ['history', 'again', 'forward'],
    shortcut: [
      [MOD, 'Shift', 'Z'],
      ['Ctrl', 'Y'],
    ],
    isAvailable: () => useEditorStore.temporal.getState().futureStates.length > 0,
    run: redo,
  },
  {
    id: 'add-node',
    group: 'actions',
    label: 'Add a node',
    menuLabel: 'Add node…',
    keywords: ['insert', 'create', 'new node', 'browse'],
    shortcut: [['Space']],
    run: ({ opener, services }) => {
      services.openAddNodeMenu(placementNear(opener), opener)
    },
  },
  {
    id: 'add-comment',
    group: 'actions',
    label: 'Add a comment',
    menuLabel: 'Add comment',
    keywords: ['note', 'frame', 'annotation', 'group'],
    shortcut: [],
    run: ({ opener, services }) => {
      const nodeId = services.addNode(COMMENT_TYPE, placementNear(opener))
      if (nodeId !== null) focusFlowNode(nodeId)
    },
  },
  {
    id: 'copy',
    group: 'actions',
    label: 'Copy selected nodes',
    menuLabel: 'Copy',
    keywords: ['clipboard'],
    shortcut: [[MOD, 'C']],
    isAvailable: hasRemovableTargets,
    run: ({ opener }) => {
      void copySelection(nodeTargets(opener))
    },
  },
  {
    id: 'paste',
    group: 'actions',
    label: 'Paste nodes',
    menuLabel: 'Paste',
    keywords: ['clipboard'],
    shortcut: [[MOD, 'V']],
    run: () => {
      void pasteFromClipboard()
    },
  },
  {
    id: 'duplicate',
    group: 'actions',
    label: 'Duplicate selected nodes',
    menuLabel: 'Duplicate',
    keywords: ['clone', 'copy'],
    shortcut: [],
    isAvailable: hasRemovableTargets,
    run: ({ opener }) => {
      const [firstCopy] = duplicateNodes(nodeTargets(opener))
      if (firstCopy !== undefined) focusFlowNode(firstCopy)
    },
  },
  {
    id: 'select-all',
    group: 'actions',
    label: 'Select all nodes',
    menuLabel: 'Select all',
    keywords: ['everything'],
    shortcut: [[MOD, 'A']],
    run: selectAllNodes,
  },
  {
    id: 'delete',
    group: 'actions',
    label: 'Delete selected nodes',
    menuLabel: 'Delete',
    keywords: ['remove', 'erase'],
    // The Delete key is handled by the canvas, which also deletes selected connections.
    shortcut: [],
    isAvailable: hasRemovableTargets,
    run: ({ opener }) => {
      getStore().removeSelection(nodeTargets(opener), [])
      focusOpenerOrCanvas(null)
    },
  },
  {
    id: 'new-graph',
    group: 'actions',
    label: 'Start a new graph',
    keywords: ['reset', 'clear', 'empty', 'start over', 'new file'],
    shortcut: [[MOD, 'Alt', 'N']],
    run: ({ opener, services }) => {
      services.requestNewGraph(opener)
    },
  },
]

const VIEW_COMMANDS: readonly Command[] = [
  {
    id: 'fit-view',
    group: 'view',
    label: 'Fit all nodes in view',
    menuLabel: 'Fit view',
    keywords: ['zoom', 'frame', 'center', 'reset view'],
    shortcut: [['F']],
    run: ({ services }) => {
      services.fitView()
    },
  },
  panelCommand('blackboard'),
  panelCommand('inspector'),
  panelCommand('preview'),
  panelCommand('code'),
  layoutCommand('docked'),
  layoutCommand('split'),
  layoutCommand('full'),
  {
    id: 'cycle-preview-layout',
    group: 'view',
    label: 'Next preview layout: docked, split, full',
    keywords: ['preview', 'cycle'],
    shortcut: [['Shift', 'P']],
    run: () => {
      getStore().cyclePreviewLayout()
    },
  },
  {
    id: 'toggle-theme',
    group: 'view',
    label: 'Switch between light and dark theme',
    keywords: ['appearance', 'mode', 'color scheme'],
    shortcut: [],
    run: ({ services }) => {
      services.toggleTheme()
    },
  },
  {
    id: 'show-shortcuts',
    group: 'view',
    label: 'Show keyboard shortcuts',
    keywords: ['help', 'keys', 'hotkeys', 'keyboard'],
    shortcut: [['?']],
    run: ({ opener, services }) => {
      services.openShortcutsDialog(opener)
    },
  },
  {
    id: 'open-command-palette',
    group: 'view',
    label: 'Open the command palette',
    keywords: ['search', 'commands'],
    shortcut: [[MOD, 'K']],
    run: ({ opener, services }) => {
      services.openCommandPalette(opener)
    },
  },
]

/** Every editor action, defined once for the palette, the shortcuts catalog and the menus. */
export const COMMANDS: readonly Command[] = [...ACTION_COMMANDS, ...VIEW_COMMANDS]

const COMMANDS_BY_ID: ReadonlyMap<string, Command> = new Map(
  COMMANDS.map((command) => [command.id, command]),
)

export function findCommand(id: CommandId): Command | undefined {
  return COMMANDS_BY_ID.get(id)
}

/** What the palette lists: everything but the palette itself. */
export const PALETTE_COMMANDS: readonly Command[] = COMMANDS.filter(
  (command) => command.id !== 'open-command-palette',
)

/** The command each panel key runs: B, I, P and C toggle a panel; Shift+P cycles the layout. */
export function panelCommandId(action: PanelShortcutAction): CommandId {
  return action.kind === 'toggle' ? `toggle-${action.panel}` : 'cycle-preview-layout'
}

/** Anything but letters, digits and `?` separates words ("layout:", "Ctrl/⌘"). */
const WORD_SEPARATOR = /[^\p{L}\p{N}?]+/u

/** The lowercase words of a text or a search query. */
export function wordsOf(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(WORD_SEPARATOR)
    .filter((word) => word !== '')
}

/**
 * Whether every query word starts a word of `text`, in any order: "spl" finds "Split", but "ine"
 * doesn't find "Sine", so short queries don't match the middle of unrelated words.
 */
export function startsWordsFor(text: string, queryWordList: readonly string[]): boolean {
  const textWords = wordsOf(text)
  return queryWordList.every((queryWord) =>
    textWords.some((textWord) => textWord.startsWith(queryWord)),
  )
}

/**
 * Case-insensitive search over labels and keywords (see `startsWordsFor`). Keeps registry order;
 * an empty query keeps every command.
 */
export function searchCommands(commands: readonly Command[], query: string): readonly Command[] {
  const queryWordList = wordsOf(query)
  return commands.filter((command) =>
    startsWordsFor([command.label, ...command.keywords].join(' '), queryWordList),
  )
}
