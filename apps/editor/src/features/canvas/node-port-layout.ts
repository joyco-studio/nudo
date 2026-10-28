import { COLLAPSED_PARAM, MASTER_NODE_ID } from '@nudo-tsl/core'
import type { GraphNode, InputDefinition, OutputDefinition } from '@nudo-tsl/core'

import type { MessageKey } from '@/i18n/translate'

import type { FlowNodeData } from './to-flow'

/** Master Stack inputs that run in the vertex stage; every other input is a fragment input. */
const VERTEX_INPUT_IDS: ReadonlySet<string> = new Set(['position'])
/** Master Stack inputs an unlit material ignores (it has no lighting to feed). */
const UNLIT_IGNORED_INPUT_IDS: ReadonlySet<string> = new Set(['metalness', 'roughness', 'normal'])
export const UNLIT_IGNORED_HINT: MessageKey = 'node.unlitIgnores'

export interface InputRowModel {
  readonly input: InputDefinition<string>
  /** Why the row has no effect right now, shown in place of its field; null when it applies. */
  readonly disabledHint: MessageKey | null
}

export interface PortGroup {
  /** The group's heading (the Master Stack's "Vertex", "Fragment"); null for a plain list. */
  readonly title: MessageKey | null
  readonly rows: readonly InputRowModel[]
}

/** The universal `collapsed` param: a collapsed node shows only its connected ports. */
export function isNodeCollapsed(data: FlowNodeData): boolean {
  return data.node.params[COLLAPSED_PARAM] === true
}

/** The collapse action, worded the same on the header toggle and in the context menu. */
export function portsToggleLabel(isCollapsed: boolean): MessageKey {
  return isCollapsed ? 'node.showPorts' : 'node.hidePorts'
}

function isUnlitMaster(node: GraphNode): boolean {
  return node.id === MASTER_NODE_ID && node.params.lighting === 'unlit'
}

function visibleInputs(data: FlowNodeData): readonly InputDefinition<string>[] {
  const { inputs } = data.definition
  if (!isNodeCollapsed(data)) return inputs
  return inputs.filter((input) => data.connectedInputs.has(input.id))
}

export function visibleOutputs(data: FlowNodeData): readonly OutputDefinition<string>[] {
  const { outputs } = data.definition
  if (!isNodeCollapsed(data)) return outputs
  return outputs.filter((output) => data.connectedOutputs.has(output.id))
}

/** The input rows to draw, grouped like the Master Stack (Vertex, Fragment) or in one list. */
export function inputGroups(data: FlowNodeData): readonly PortGroup[] {
  return groupInputs(data.node, visibleInputs(data))
}

/** Groups the given inputs of a node into rows, each with why it has no effect right now. */
export function groupInputs(
  node: GraphNode,
  inputs: readonly InputDefinition<string>[],
): readonly PortGroup[] {
  const isUnlit = isUnlitMaster(node)
  const rows = inputs.map((input) => ({
    input,
    disabledHint: isUnlit && UNLIT_IGNORED_INPUT_IDS.has(input.id) ? UNLIT_IGNORED_HINT : null,
  }))
  if (node.id !== MASTER_NODE_ID) return [{ title: null, rows }]
  return [
    {
      title: 'node.group.vertex',
      rows: rows.filter((row) => VERTEX_INPUT_IDS.has(row.input.id)),
    },
    {
      title: 'node.group.fragment',
      rows: rows.filter((row) => !VERTEX_INPUT_IDS.has(row.input.id)),
    },
  ]
}
