import type { Graph, NodeId, NodeRegistry, NodeTypeId } from '@nudo-tsl/core'

import {
  categoryLabelKey,
  matchesNodeQuery,
  searchNodes,
} from '@/features/add-node-menu/search-nodes'
import { nodeTitle } from '@/features/canvas/to-flow'
import { translateEnglish } from '@/i18n/translate'
import type { Translate } from '@/i18n/translate'

import { PALETTE_COMMANDS } from './command-registry'
import type { Command, CommandGroupId } from './command-registry'
import { searchCommands } from './command-search'

/**
 * Palette groups, in palette order: the few commands first, then the nodes in the graph, then
 * the long catalog of nodes to add, so a command is never buried under node names.
 */
export type PaletteGroupId = CommandGroupId | 'nodes-in-graph' | 'add-node'

export type PaletteItem =
  | { readonly kind: 'command'; readonly key: string; readonly command: Command }
  | {
      readonly kind: 'jump'
      readonly key: string
      readonly nodeId: NodeId
      readonly label: string
      /** The node's kind, shown when its title doesn't already say it (a comment's title). */
      readonly detail?: string
    }
  | {
      readonly kind: 'add'
      readonly key: string
      readonly type: NodeTypeId
      readonly label: string
      /** The node's category. */
      readonly detail: string
    }

export interface PaletteGroup {
  readonly id: PaletteGroupId
  readonly items: readonly PaletteItem[]
}

export interface PaletteQuery {
  readonly query: string
  readonly graph: Graph
  /** The registry in the UI language: node names, descriptions and search words. */
  readonly registry: NodeRegistry
  /** The commands to search; defaults to every palette command. */
  readonly commands?: readonly Command[]
  /** The UI language's messages; English by default. Commands also match their English words. */
  readonly t?: Translate
}

function commandGroup(commands: readonly Command[], id: CommandGroupId): readonly PaletteGroup[] {
  const items = commands
    .filter((command) => command.group === id)
    .map((command): PaletteItem => ({ kind: 'command', key: `command:${command.id}`, command }))
  return items.length === 0 ? [] : [{ id, items }]
}

/** Graph nodes the add-node matcher accepts (title included), in graph order. */
function graphNodeItems(
  graph: Graph,
  registry: NodeRegistry,
  query: string,
): readonly PaletteItem[] {
  return Object.values(graph.nodes).flatMap((node): PaletteItem[] => {
    const definition = registry.get(node.type)
    if (definition === undefined) return []
    const label = nodeTitle(node, definition, graph.properties)
    // The add-node search's matcher, plus the title the node shows (a comment's own title).
    if (!matchesNodeQuery(definition, query, [label])) return []
    const key = `node:${node.id}`
    return label === definition.label
      ? [{ kind: 'jump', key, nodeId: node.id, label }]
      : [{ kind: 'jump', key, nodeId: node.id, label, detail: definition.label }]
  })
}

function addNodeItems(registry: NodeRegistry, query: string, t: Translate): readonly PaletteItem[] {
  return searchNodes(registry.list(), query).flatMap((group) =>
    group.items.map((definition): PaletteItem => ({
      kind: 'add',
      key: `add:${definition.type}`,
      type: definition.type,
      label: definition.label,
      detail: t(categoryLabelKey(group.category)),
    })),
  )
}

function nodeGroup(id: PaletteGroupId, items: readonly PaletteItem[]): readonly PaletteGroup[] {
  return items.length === 0 ? [] : [{ id, items }]
}

/**
 * Everything the palette shows for a query, grouped and without empty groups. Before anything is
 * typed it lists only the commands; nodes join once there is a word to look for. Commands match
 * at word starts (`command-search.ts`); both node groups use the add-node menu's matcher.
 */
export function paletteResults({
  query,
  graph,
  registry,
  commands = PALETTE_COMMANDS,
  t = translateEnglish,
}: PaletteQuery): readonly PaletteGroup[] {
  const matches = searchCommands(commands, query, t)
  const commandGroups = [
    ...commandGroup(matches, 'actions'),
    ...commandGroup(matches, 'view'),
    ...commandGroup(matches, 'examples'),
  ]
  if (query.trim() === '') return commandGroups
  return [
    ...commandGroups,
    ...nodeGroup('nodes-in-graph', graphNodeItems(graph, registry, query)),
    ...nodeGroup('add-node', addNodeItems(registry, query, t)),
  ]
}
