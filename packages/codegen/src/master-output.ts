import { MASTER_NODE_ID, MASTER_NODE_TYPE, MASTER_SLOTS, portKey } from '@nudo-tsl/core'
import type { Graph, MasterSlot, NodeRegistry, TslFacade } from '@nudo-tsl/core'
import type { CodeExpression } from './code-expression'

export type MasterLighting = 'standard' | 'unlit'
export type MasterSurface = 'auto' | 'opaque' | 'transparent'
export type MaterialClass = 'MeshStandardNodeMaterial' | 'MeshBasicNodeMaterial'
export type MaterialNodeProperty =
  | 'positionNode'
  | 'colorNode'
  | 'emissiveNode'
  | 'metalnessNode'
  | 'roughnessNode'
  | 'normalNode'
  | 'opacityNode'
  | 'alphaTestNode'

export interface MasterSettings {
  readonly lighting: MasterLighting
  readonly surface: MasterSurface
  readonly twoSided: boolean
}

/** One assignment of the exported `nodes` object. */
export interface NodeEntry {
  readonly property: MaterialNodeProperty
  readonly expression: CodeExpression
}

type MasterSlots = Partial<Record<MasterSlot, CodeExpression>>

const DEFAULT_SETTINGS: MasterSettings = { lighting: 'standard', surface: 'auto', twoSided: false }
const LIGHTING_VALUES: readonly MasterLighting[] = ['standard', 'unlit']
const SURFACE_VALUES: readonly MasterSurface[] = ['auto', 'opaque', 'transparent']
const FULLY_OPAQUE = 1
const OPACITY_SLOT: MasterSlot = 'opacity'

const SLOT_PROPERTIES: Readonly<Record<MasterSlot, MaterialNodeProperty>> = {
  position: 'positionNode',
  baseColor: 'colorNode',
  emission: 'emissiveNode',
  metalness: 'metalnessNode',
  roughness: 'roughnessNode',
  normal: 'normalNode',
  opacity: 'opacityNode',
  alphaClip: 'alphaTestNode',
}

const pickOption = <V extends string>(options: readonly V[], stored: unknown, fallback: V): V =>
  options.find((option) => option === stored) ?? fallback

/**
 * The master stack's lighting, surface and two-sided params, defaulting what is not stored. The
 * live runtime reads the same params (`packages/runtime/src/master-settings.ts`).
 */
export function readMasterSettings(graph: Graph): MasterSettings {
  const params = graph.nodes[MASTER_NODE_ID]?.params
  if (params === undefined) return DEFAULT_SETTINGS
  return {
    lighting: pickOption(LIGHTING_VALUES, params.lighting, DEFAULT_SETTINGS.lighting),
    surface: pickOption(SURFACE_VALUES, params.surface, DEFAULT_SETTINGS.surface),
    twoSided: params.twoSided === true,
  }
}

export const materialClassOf = (lighting: MasterLighting): MaterialClass =>
  lighting === 'unlit' ? 'MeshBasicNodeMaterial' : 'MeshStandardNodeMaterial'

const isOpacityConnected = (graph: Graph): boolean => {
  const opacityInput = portKey({ nodeId: MASTER_NODE_ID, portId: OPACITY_SLOT })
  return Object.values(graph.edges).some((edge) => portKey(edge.to) === opacityInput)
}

/** The opacity the master holds while nothing is connected to it. */
function inlineOpacity(graph: Graph, registry: NodeRegistry): number | null {
  const stored = graph.nodes[MASTER_NODE_ID]?.inputValues[OPACITY_SLOT]
  const fallback = registry
    .get(MASTER_NODE_TYPE)
    ?.inputs.find((input) => input.id === OPACITY_SLOT)?.default
  const value = stored ?? fallback
  return value?.type === 'float' ? value.value : null
}

/** Mirrors the live runtime: `auto` blends when opacity is wired or its inline value is below 1. */
export function resolveTransparent(
  settings: MasterSettings,
  graph: Graph,
  registry: NodeRegistry,
): boolean {
  if (settings.surface === 'opaque') return false
  if (settings.surface === 'transparent') return true
  if (isOpacityConnected(graph)) return true
  const opacity = inlineOpacity(graph, registry)
  return opacity !== null && opacity < FULLY_OPAQUE
}

/** Unlit shading has no separate emission: it is added to the color. */
function unlitColor(
  tsl: TslFacade<CodeExpression>,
  slots: MasterSlots,
): CodeExpression | undefined {
  const { baseColor, emission } = slots
  if (baseColor === undefined || emission === undefined) return baseColor ?? emission
  return tsl.add(baseColor, emission)
}

const entry = (
  property: MaterialNodeProperty,
  expression: CodeExpression | undefined,
): readonly NodeEntry[] => (expression === undefined ? [] : [{ property, expression }])

/** The material properties the master slots assign, in the order the live runtime assigns them. */
export function createNodeEntries(
  tsl: TslFacade<CodeExpression>,
  slots: MasterSlots,
  lighting: MasterLighting,
): readonly NodeEntry[] {
  if (lighting === 'standard') {
    return MASTER_SLOTS.flatMap((slot) => entry(SLOT_PROPERTIES[slot], slots[slot]))
  }
  // An unlit material reads only these; metalness, roughness and normal are ignored.
  return [
    ...entry('positionNode', slots.position),
    ...entry('colorNode', unlitColor(tsl, slots)),
    ...entry('opacityNode', slots.opacity),
    ...entry('alphaTestNode', slots.alphaClip),
  ]
}
