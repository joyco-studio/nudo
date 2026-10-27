import type { MasterSlot } from '../compiler/compile-backend'
import { MASTER_SLOTS } from '../compiler/compile-backend'
import type { NodeRegistry } from '../registry/node-registry'
import { portKey } from '../type-inference/port-key'
import type { Graph } from '../types/graph'
import { MASTER_NODE_ID, MASTER_NODE_TYPE } from '../types/ids'
import type { TslFacade } from '../types/tsl-facade'

export type MasterLighting = 'standard' | 'unlit'
export type MasterSurface = 'auto' | 'opaque' | 'transparent'

export interface MasterSettings {
  readonly lighting: MasterLighting
  readonly surface: MasterSurface
  readonly twoSided: boolean
}

export const DEFAULT_MASTER_SETTINGS: MasterSettings = {
  lighting: 'standard',
  surface: 'auto',
  twoSided: false,
}

const LIGHTING_VALUES: readonly MasterLighting[] = ['standard', 'unlit']
const SURFACE_VALUES: readonly MasterSurface[] = ['auto', 'opaque', 'transparent']

const pickOption = <V extends string>(options: readonly V[], stored: unknown, fallback: V): V =>
  options.find((option) => option === stored) ?? fallback

/** The default the master definition declares for an enum param, when it is a valid option. */
function declaredDefault<V extends string>(
  registry: NodeRegistry,
  paramId: string,
  options: readonly V[],
  fallback: V,
): V {
  const param = registry
    .get(MASTER_NODE_TYPE)
    ?.params?.find((candidate) => candidate.id === paramId)
  return param?.kind === 'enum' ? pickOption(options, param.default, fallback) : fallback
}

/**
 * The master stack's lighting, surface and two-sided params. A param that is not stored (or holds
 * an unknown option) takes the master definition's default.
 */
export function readMasterSettings(graph: Graph, registry: NodeRegistry): MasterSettings {
  const params = graph.nodes[MASTER_NODE_ID]?.params
  const defaults = {
    lighting: declaredDefault(
      registry,
      'lighting',
      LIGHTING_VALUES,
      DEFAULT_MASTER_SETTINGS.lighting,
    ),
    surface: declaredDefault(registry, 'surface', SURFACE_VALUES, DEFAULT_MASTER_SETTINGS.surface),
  }
  if (params === undefined) return { ...defaults, twoSided: DEFAULT_MASTER_SETTINGS.twoSided }
  return {
    lighting: pickOption(LIGHTING_VALUES, params.lighting, defaults.lighting),
    surface: pickOption(SURFACE_VALUES, params.surface, defaults.surface),
    twoSided: params.twoSided === true,
  }
}

const FULLY_OPAQUE = 1

/** Whether an inline opacity needs the transparent render path to show. */
export const isTranslucent = (opacity: number): boolean => opacity < FULLY_OPAQUE

const OPACITY_INPUT = portKey({ nodeId: MASTER_NODE_ID, portId: 'opacity' })

/** Whether anything is wired into the master's opacity input. */
export const isOpacityConnected = (graph: Graph): boolean =>
  Object.values(graph.edges).some((edge) => portKey(edge.to) === OPACITY_INPUT)

/** The opacity the master holds while nothing is wired to it, or `null` if it is not a float. */
export function readInlineOpacity(graph: Graph, registry: NodeRegistry): number | null {
  const stored = graph.nodes[MASTER_NODE_ID]?.inputValues.opacity
  const declared = registry
    .get(MASTER_NODE_TYPE)
    ?.inputs.find((input) => input.id === 'opacity')?.default
  const value = stored ?? declared
  return value?.type === 'float' ? value.value : null
}

export interface TransparencyInput {
  readonly surface: MasterSurface
  readonly opacityConnected: boolean
  /** The opacity held while nothing is wired to it; `null` when it is not a plain number. */
  readonly inlineOpacity: number | null
}

/** `auto` blends when opacity is wired, or when its inline value is below 1. */
export function resolveTransparency({
  surface,
  opacityConnected,
  inlineOpacity,
}: TransparencyInput): boolean {
  if (surface === 'opaque') return false
  if (surface === 'transparent') return true
  return opacityConnected || (inlineOpacity !== null && isTranslucent(inlineOpacity))
}

/** The material properties the master slots drive. */
export type MasterMaterialProperty =
  | 'positionNode'
  | 'colorNode'
  | 'emissiveNode'
  | 'metalnessNode'
  | 'roughnessNode'
  | 'normalNode'
  | 'opacityNode'
  | 'alphaTestNode'

export interface MaterialAssignment<E> {
  readonly property: MasterMaterialProperty
  readonly expression: E
}

/** All the master needs from a facade: adding emission to the base color. */
type ColorFacade<E> = Pick<TslFacade<E>, 'add'>

type MasterSlots<E> = Partial<Record<MasterSlot, E>>

const SLOT_PROPERTIES: Readonly<Record<MasterSlot, MasterMaterialProperty>> = {
  position: 'positionNode',
  baseColor: 'colorNode',
  emission: 'emissiveNode',
  metalness: 'metalnessNode',
  roughness: 'roughnessNode',
  normal: 'normalNode',
  opacity: 'opacityNode',
  alphaClip: 'alphaTestNode',
}

/** Unlit shading has no separate emission: it is added to the color. */
export function unlitColor<E>(tsl: ColorFacade<E>, slots: MasterSlots<E>): E | undefined {
  const { baseColor, emission } = slots
  if (baseColor === undefined || emission === undefined) return baseColor ?? emission
  return tsl.add(baseColor, emission)
}

const assignment = <E>(
  property: MasterMaterialProperty,
  expression: E | undefined,
): readonly MaterialAssignment<E>[] => (expression === undefined ? [] : [{ property, expression }])

/**
 * The material properties a compiled master assigns, in slot order. A standard material takes
 * every slot; an unlit one reads only position, color (base + emission), opacity and alpha clip,
 * so metalness, roughness and normal are ignored.
 */
export function masterMaterialAssignments<E>(
  tsl: ColorFacade<E>,
  slots: MasterSlots<E>,
  lighting: MasterLighting,
): readonly MaterialAssignment<E>[] {
  if (lighting === 'standard') {
    return MASTER_SLOTS.flatMap((slot) => assignment(SLOT_PROPERTIES[slot], slots[slot]))
  }
  return [
    ...assignment('positionNode', slots.position),
    ...assignment('colorNode', unlitColor(tsl, slots)),
    ...assignment('opacityNode', slots.opacity),
    ...assignment('alphaTestNode', slots.alphaClip),
  ]
}
