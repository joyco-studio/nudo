import {
  COLLAPSED_PARAM,
  MASTER_NODE_ID,
  PHYSICAL_FEATURES,
  PHYSICAL_FEATURE_PARAMS,
  PHYSICAL_FEATURE_SLOTS,
} from '@nudo-tsl/core'
import type { GraphNode, InputDefinition, OutputDefinition, PhysicalFeature } from '@nudo-tsl/core'

import type { MessageKey, Translate } from '@/i18n/translate'

import type { FlowNodeData } from './to-flow'

/** Master Stack inputs that run in the vertex stage; every other input is a fragment input. */
const VERTEX_INPUT_IDS: ReadonlySet<string> = new Set(['position'])
/** Master Stack inputs an unlit material ignores (it has no lighting to feed). */
const UNLIT_IGNORED_INPUT_IDS: ReadonlySet<string> = new Set(['metalness', 'roughness', 'normal'])
/** Each Master Stack input only a physical material reads, with the feature switch it needs. */
const PHYSICAL_INPUT_FEATURES: ReadonlyMap<string, PhysicalFeature> = new Map(
  PHYSICAL_FEATURES.flatMap((feature) =>
    PHYSICAL_FEATURE_SLOTS[feature].map((slot): [string, PhysicalFeature] => [slot, feature]),
  ),
)

/** Why an input row has no effect right now. */
export type DisabledHint =
  | { readonly reason: 'unlit' }
  | { readonly reason: 'physicalOnly' }
  | { readonly reason: 'featureOff'; readonly feature: PhysicalFeature }

/** How the "Turn on {feature}" hint names each physical feature. */
const PHYSICAL_FEATURE_NAMES: Readonly<Record<PhysicalFeature, MessageKey>> = {
  transmission: 'node.physicalFeature.transmission',
  clearcoat: 'node.physicalFeature.clearcoat',
  sheen: 'node.physicalFeature.sheen',
  iridescence: 'node.physicalFeature.iridescence',
}

/** The hint's text, shown in place of the row's field. */
export function disabledHintText(hint: DisabledHint, t: Translate): string {
  switch (hint.reason) {
    case 'unlit':
      return t('node.unlitIgnores')
    case 'physicalOnly':
      return t('node.physicalOnly')
    case 'featureOff':
      return t('node.physicalFeatureOff', { feature: t(PHYSICAL_FEATURE_NAMES[hint.feature]) })
  }
}

export interface InputRowModel {
  readonly input: InputDefinition<string>
  /** Why the row has no effect right now, shown in place of its field; null when it applies. */
  readonly disabledHint: DisabledHint | null
}

/** A group that folds away behind its heading (the Master Stack's Physical group). */
export interface GroupDisclosure {
  /** Whether the group starts open; the reader can still open or close it. */
  readonly isOpenByDefault: boolean
}

export interface PortGroup {
  /** The group's heading (the Master Stack's "Vertex", "Fragment"); null for a plain list. */
  readonly title: MessageKey | null
  /** How the group folds away; null for a group that always shows its rows. */
  readonly disclosure: GroupDisclosure | null
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

function isPhysicalMaster(node: GraphNode): boolean {
  return node.id === MASTER_NODE_ID && node.params.lighting === 'physical'
}

/**
 * Whether a param is one of the master's physical feature switches while its lighting is not
 * physical: no other material reads them, so the master hides them.
 */
export function isIdlePhysicalSwitch(node: GraphNode, paramId: string): boolean {
  return (
    node.id === MASTER_NODE_ID &&
    !isPhysicalMaster(node) &&
    PHYSICAL_FEATURES.some((feature) => PHYSICAL_FEATURE_PARAMS[feature] === paramId)
  )
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

/**
 * The input rows to draw, grouped like the Master Stack (Vertex, Fragment, Physical) or in one
 * list. A collapsed node already shows only its connected ports, so none of its groups folds.
 */
export function inputGroups(data: FlowNodeData): readonly PortGroup[] {
  const groups = groupInputs(data.node, visibleInputs(data))
  if (!isNodeCollapsed(data)) return groups
  return groups.map((group) => ({ ...group, disclosure: null }))
}

/**
 * The rows a group shows: all of them while it is open, only the connected ones while it is
 * folded away (an edge always has its port to land on).
 */
export function shownRows(
  group: PortGroup,
  isOpen: boolean,
  connectedInputs: ReadonlySet<string>,
): readonly InputRowModel[] {
  if (group.disclosure === null || isOpen) return group.rows
  return group.rows.filter((row) => connectedInputs.has(row.input.id))
}

function masterInputHint(node: GraphNode, inputId: string): DisabledHint | null {
  const feature = PHYSICAL_INPUT_FEATURES.get(inputId)
  if (feature !== undefined) {
    if (!isPhysicalMaster(node)) return { reason: 'physicalOnly' }
    return node.params[PHYSICAL_FEATURE_PARAMS[feature]] === true
      ? null
      : { reason: 'featureOff', feature }
  }
  const isUnlit = node.params.lighting === 'unlit'
  return isUnlit && UNLIT_IGNORED_INPUT_IDS.has(inputId) ? { reason: 'unlit' } : null
}

/** Groups the given inputs of a node into rows, each with why it has no effect right now. */
export function groupInputs(
  node: GraphNode,
  inputs: readonly InputDefinition<string>[],
): readonly PortGroup[] {
  if (node.id !== MASTER_NODE_ID) {
    return [
      {
        title: null,
        disclosure: null,
        rows: inputs.map((input) => ({ input, disabledHint: null })),
      },
    ]
  }
  const rows = inputs.map((input) => ({ input, disabledHint: masterInputHint(node, input.id) }))
  const isPhysicalRow = (row: InputRowModel): boolean => PHYSICAL_INPUT_FEATURES.has(row.input.id)
  return [
    {
      title: 'node.group.vertex',
      disclosure: null,
      rows: rows.filter((row) => VERTEX_INPUT_IDS.has(row.input.id)),
    },
    {
      title: 'node.group.fragment',
      disclosure: null,
      rows: rows.filter((row) => !VERTEX_INPUT_IDS.has(row.input.id) && !isPhysicalRow(row)),
    },
    {
      title: 'node.group.physical',
      disclosure: { isOpenByDefault: isPhysicalMaster(node) },
      rows: rows.filter(isPhysicalRow),
    },
  ]
}
