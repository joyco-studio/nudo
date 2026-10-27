import { MASTER_NODE_ID } from '@nudo-tsl/core'
import type { InputDefinition, OutputDefinition } from '@nudo-tsl/core'

import type { FlowNodeData } from './to-flow'

/** Master Stack inputs that run in the vertex stage; every other input is a fragment input. */
const VERTEX_INPUT_IDS: ReadonlySet<string> = new Set(['position'])
/** Master Stack inputs an unlit material ignores (it has no lighting to feed). */
const UNLIT_IGNORED_INPUT_IDS: ReadonlySet<string> = new Set(['metalness', 'roughness', 'normal'])
export const UNLIT_IGNORED_HINT = 'Unlit ignores this'

export interface InputRowModel {
  readonly input: InputDefinition<string>
  /** Why the row has no effect right now, shown in place of its field; null when it applies. */
  readonly disabledHint: string | null
}

export interface PortGroup {
  readonly title: string | null
  readonly rows: readonly InputRowModel[]
}

/** Universal params every node accepts (see `UNIVERSAL_PARAMS` in core). */
export const COLLAPSED_PARAM = 'collapsed'
export const PREVIEW_MODE_PARAM = 'previewMode'

/** The universal `collapsed` param: a collapsed node shows only its connected ports. */
export function isNodeCollapsed(data: FlowNodeData): boolean {
  return data.node.params[COLLAPSED_PARAM] === true
}

/** The collapse action, worded the same on the header toggle and in the context menu. */
export function portsToggleLabel(isCollapsed: boolean): string {
  return isCollapsed ? 'Show unconnected ports' : 'Hide unconnected ports'
}

function isUnlitMaster(data: FlowNodeData): boolean {
  return data.node.id === MASTER_NODE_ID && data.node.params.lighting === 'unlit'
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
  const isUnlit = isUnlitMaster(data)
  const rows = visibleInputs(data).map((input) => ({
    input,
    disabledHint: isUnlit && UNLIT_IGNORED_INPUT_IDS.has(input.id) ? UNLIT_IGNORED_HINT : null,
  }))
  if (data.node.id !== MASTER_NODE_ID) return [{ title: null, rows }]
  return [
    { title: 'Vertex', rows: rows.filter((row) => VERTEX_INPUT_IDS.has(row.input.id)) },
    { title: 'Fragment', rows: rows.filter((row) => !VERTEX_INPUT_IDS.has(row.input.id)) },
  ]
}
