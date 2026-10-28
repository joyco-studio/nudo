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
import type { Locale } from '@/i18n/locale'
import type { MessageKey } from '@/i18n/translate'
import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'
import { redo, undo, useEditorStore } from '@/store/editor-store'

/** The palette's command groups, in palette order. Nodes are listed by the palette itself. */
export type CommandGroupId = 'actions' | 'view'

type PanelCommandId = `toggle-${PanelId}`
type LayoutCommandId = `preview-${PreviewLayout}`
type LanguageCommandId = `language-${Locale}`

export type CommandId =
  | GlobalShortcutAction
  | PanelCommandId
  | LayoutCommandId
  | LanguageCommandId
  | 'duplicate'
  | 'delete'
  | 'add-node'
  | 'add-comment'
  | 'cycle-preview-layout'
  | 'toggle-theme'
  | 'open-command-palette'

/** What commands need from the React tree: the view, the theme, the language and the dialogs. */
export interface CommandServices {
  fitView: () => void
  toggleTheme: () => void
  setLocale: (locale: Locale) => void
  openShortcutsDialog: (opener: HTMLElement | null) => void
  requestNewGraph: (opener: HTMLElement | null) => void
  openAddNodeMenu: (origin: PlacementOrigin, opener: HTMLElement | null) => void
  /** Adds and selects a node near the origin, clear of other nodes. Null when it can't be added. */
  addNode: (type: NodeTypeId, origin: PlacementOrigin) => NodeId | null
  openCommandPalette: (opener: HTMLElement | null) => void
}

/** Where a command was asked for. */
export interface CommandInvocation {
  /**
   * The element that had focus: a key's target or the palette's opener. A dialog the command
   * opens gives focus back to it. Null from a menu, which restores focus itself.
   */
  readonly opener: HTMLElement | null
  /**
   * The node a node command acts on (with the rest of the selection when the selection holds
   * it), and that new nodes land beside. Null: the selection, and the middle of the view.
   */
  readonly nodeId: NodeId | null
}

/** No element and no node: the command acts on the selection and returns focus to the canvas. */
export const UNTARGETED: CommandInvocation = { opener: null, nodeId: null }

/** An invocation from a focused element: its node, if it is (or is inside) a canvas node. */
export function invocationFrom(opener: HTMLElement | null): CommandInvocation {
  return { opener, nodeId: flowNodeIdOf(opener) }
}

export interface CommandContext extends CommandInvocation {
  readonly services: CommandServices
}

/**
 * A command's words live in the messages, keyed by its id (see `command-text.ts`): its name in the
 * palette and the shortcuts dialog (`command.<id>.label`) and other words people search for
 * (`command.<id>.keywords`).
 */
export interface Command {
  readonly id: CommandId
  readonly group: CommandGroupId
  /** A shorter name for a context menu, whose target already says what the command acts on. */
  readonly menuLabel?: MessageKey
  /** Alternative chords that run the command; empty when no key does. */
  readonly shortcut: readonly KeyChord[]
  /** False while there is nothing to act on; the palette leaves the command out then. */
  readonly isAvailable?: (nodeId: NodeId | null) => boolean
  readonly run: (context: CommandContext) => void
}

const getStore = () => useEditorStore.getState()

/** The nodes a node command applies to: the node, or the selection when it holds the node. */
function nodeTargets(nodeId: NodeId | null): readonly NodeId[] {
  return resolveActionNodeIds(nodeId, getStore().selectedNodeIds)
}

/** The master can't be copied, duplicated or deleted, so it alone gives such commands nothing. */
function hasRemovableTargets(nodeId: NodeId | null): boolean {
  return nodeTargets(nodeId).some((id) => id !== MASTER_NODE_ID)
}

/** New nodes land beside the target node, or in the middle of the view. */
export function placementNear(nodeId: NodeId | null): PlacementOrigin {
  return nodeId === null ? { kind: 'viewport-center' } : { kind: 'beside-node', nodeId }
}

function panelCommand(panel: PanelId): Command {
  return {
    id: `toggle-${panel}`,
    group: 'view',
    shortcut: [[PANEL_SHORTCUT_KEYS[panel]]],
    run: () => {
      getStore().togglePanel(panel)
    },
  }
}

function layoutCommand(layout: PreviewLayout): Command {
  return {
    id: `preview-${layout}`,
    group: 'view',
    shortcut: [],
    run: () => {
      getStore().setPreviewLayout(layout)
    },
  }
}

function languageCommand(locale: Locale): Command {
  return {
    id: `language-${locale}`,
    group: 'view',
    shortcut: [],
    run: ({ services }) => {
      services.setLocale(locale)
    },
  }
}

const ACTION_COMMANDS: readonly Command[] = [
  {
    id: 'undo',
    group: 'actions',
    shortcut: [[MOD, 'Z']],
    isAvailable: () => useEditorStore.temporal.getState().pastStates.length > 0,
    run: undo,
  },
  {
    id: 'redo',
    group: 'actions',
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
    menuLabel: 'command.add-node.menu',
    shortcut: [['Space']],
    run: ({ opener, nodeId, services }) => {
      services.openAddNodeMenu(placementNear(nodeId), opener)
    },
  },
  {
    id: 'add-comment',
    group: 'actions',
    menuLabel: 'command.add-comment.menu',
    shortcut: [],
    run: ({ nodeId, services }) => {
      const commentId = services.addNode(COMMENT_TYPE, placementNear(nodeId))
      if (commentId !== null) focusFlowNode(commentId)
    },
  },
  {
    id: 'copy',
    group: 'actions',
    menuLabel: 'command.copy.menu',
    shortcut: [[MOD, 'C']],
    isAvailable: hasRemovableTargets,
    run: ({ nodeId }) => {
      void copySelection(nodeTargets(nodeId))
    },
  },
  {
    id: 'paste',
    group: 'actions',
    menuLabel: 'command.paste.menu',
    shortcut: [[MOD, 'V']],
    run: () => {
      void pasteFromClipboard()
    },
  },
  {
    id: 'duplicate',
    group: 'actions',
    menuLabel: 'command.duplicate.menu',
    shortcut: [],
    isAvailable: hasRemovableTargets,
    run: ({ nodeId }) => {
      const [firstCopy] = duplicateNodes(nodeTargets(nodeId))
      if (firstCopy !== undefined) focusFlowNode(firstCopy)
    },
  },
  {
    id: 'select-all',
    group: 'actions',
    menuLabel: 'command.select-all.menu',
    shortcut: [[MOD, 'A']],
    run: selectAllNodes,
  },
  {
    id: 'delete',
    group: 'actions',
    menuLabel: 'command.delete.menu',
    // The Delete key is handled by the canvas, which also deletes selected connections.
    shortcut: [],
    isAvailable: hasRemovableTargets,
    run: ({ nodeId }) => {
      getStore().removeSelection(nodeTargets(nodeId), [])
      focusOpenerOrCanvas(null)
    },
  },
  {
    id: 'new-graph',
    group: 'actions',
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
    menuLabel: 'command.fit-view.menu',
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
    shortcut: [['Shift', 'P']],
    run: () => {
      getStore().cyclePreviewLayout()
    },
  },
  {
    id: 'toggle-theme',
    group: 'view',
    shortcut: [],
    run: ({ services }) => {
      services.toggleTheme()
    },
  },
  languageCommand('en'),
  languageCommand('es'),
  {
    id: 'show-shortcuts',
    group: 'view',
    shortcut: [['?']],
    run: ({ opener, services }) => {
      services.openShortcutsDialog(opener)
    },
  },
  {
    id: 'open-command-palette',
    group: 'view',
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
