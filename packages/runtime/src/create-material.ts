import { MASTER_NODE_ID, MASTER_SLOTS, compile, portKey } from '@nudo-tsl/core'
import type {
  CompileError,
  Graph,
  MasterSlot,
  NodeRegistry,
  PortKey,
  PropertyId,
  TslFacade,
} from '@nudo-tsl/core'
import { DoubleSide, FrontSide } from 'three'
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
import { createLiveBackend } from './live-backend'
import type { LiveProperty, LiveUniform } from './live-backend'
import type { LiveNode } from './live-facade'
import { DEFAULT_MASTER_SETTINGS, readMasterSettings } from './master-settings'
import type { MasterSettings, MasterSurface } from './master-settings'
import type { MaterialOptions } from './texture-resolution'

export type RuntimeMaterial = MeshStandardNodeMaterial | MeshBasicNodeMaterial

export interface MaterialBuild {
  /** `null` when compilation failed. */
  readonly material: RuntimeMaterial | null
  readonly uniforms: ReadonlyMap<PortKey, LiveUniform>
  /** One shared live value per Blackboard property the graph reads. */
  readonly properties: ReadonlyMap<PropertyId, LiveProperty>
  /** Asset ids that were asked for but resolved to the neutral texture instead. */
  readonly missingTextures: readonly string[]
  /** The master `surface` the material was built with; `auto` follows the opacity input. */
  readonly surface: MasterSurface
  readonly errors: readonly CompileError[]
}

/** The build of a graph that did not compile: no material, nothing live. */
export const failedBuild = (errors: readonly CompileError[]): MaterialBuild => ({
  material: null,
  uniforms: new Map(),
  properties: new Map(),
  missingTextures: [],
  surface: DEFAULT_MASTER_SETTINGS.surface,
  errors,
})

type MasterSlots = Partial<Record<MasterSlot, LiveNode>>

type MaterialNodeProperty =
  | 'positionNode'
  | 'colorNode'
  | 'emissiveNode'
  | 'metalnessNode'
  | 'roughnessNode'
  | 'normalNode'
  | 'opacityNode'
  | 'alphaTestNode'

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

export const OPACITY_INPUT: PortKey = portKey({ nodeId: MASTER_NODE_ID, portId: 'opacity' })

const FULLY_OPAQUE = 1

/** Whether an inline opacity needs the transparent render path to show. */
export const isTranslucent = (opacity: number): boolean => opacity < FULLY_OPAQUE

const isOpacityConnected = (graph: Graph): boolean =>
  Object.values(graph.edges).some((edge) => portKey(edge.to) === OPACITY_INPUT)

/** An unconnected opacity reads from a uniform; a connected one has none and is always blended. */
function isInlineOpacityTranslucent(uniforms: ReadonlyMap<PortKey, LiveUniform>): boolean {
  const inlineOpacity = uniforms.get(OPACITY_INPUT)?.value
  return typeof inlineOpacity === 'number' && isTranslucent(inlineOpacity)
}

function resolveTransparency(
  surface: MasterSurface,
  graph: Graph,
  uniforms: ReadonlyMap<PortKey, LiveUniform>,
): boolean {
  if (surface === 'opaque') return false
  if (surface === 'transparent') return true
  return isOpacityConnected(graph) || isInlineOpacityTranslucent(uniforms)
}

/** Unlit shading has no separate emission: it is added to the color. */
function unlitColor(tsl: TslFacade<LiveNode>, slots: MasterSlots): LiveNode | undefined {
  const { baseColor, emission } = slots
  if (baseColor === undefined || emission === undefined) return baseColor ?? emission
  return tsl.add(baseColor, emission)
}

type NodeAssignment = readonly [MaterialNodeProperty, LiveNode | undefined]

const standardAssignments = (slots: MasterSlots): readonly NodeAssignment[] =>
  MASTER_SLOTS.map((slot) => [SLOT_PROPERTIES[slot], slots[slot]])

/** An unlit material reads only these; metalness, roughness and normal are ignored. */
const unlitAssignments = (
  tsl: TslFacade<LiveNode>,
  slots: MasterSlots,
): readonly NodeAssignment[] => [
  ['positionNode', slots.position],
  ['colorNode', unlitColor(tsl, slots)],
  ['opacityNode', slots.opacity],
  ['alphaTestNode', slots.alphaClip],
]

function buildMaterial(
  tsl: TslFacade<LiveNode>,
  slots: MasterSlots,
  settings: MasterSettings,
  graph: Graph,
  uniforms: ReadonlyMap<PortKey, LiveUniform>,
): RuntimeMaterial {
  const isUnlit = settings.lighting === 'unlit'
  const material = isUnlit ? new MeshBasicNodeMaterial() : new MeshStandardNodeMaterial()
  const assignments = isUnlit ? unlitAssignments(tsl, slots) : standardAssignments(slots)
  for (const [property, expression] of assignments) {
    if (expression === undefined) continue
    // Object.assign sidesteps @types/three's per-node-type property types, which cannot be
    // satisfied by a type-erased LiveNode (the graph's types are only known at runtime).
    Object.assign(material, { [property]: expression })
  }
  material.side = settings.twoSided ? DoubleSide : FrontSide
  material.transparent = resolveTransparency(settings.surface, graph, uniforms)
  return material
}

/** Compiles the graph's master stack into a node material plus its live inline uniforms. */
export function createMaterial(
  graph: Graph,
  registry: NodeRegistry,
  options?: MaterialOptions,
): MaterialBuild {
  const backend = createLiveBackend(options)
  const result = compile(graph, registry, backend, { kind: 'master' })
  if (!result.ok) return failedBuild(result.errors)
  if (result.output.kind !== 'master') {
    return failedBuild([
      {
        nodeId: MASTER_NODE_ID,
        code: 'build-failed',
        message: 'Compiler returned no master output',
      },
    ])
  }
  const settings = readMasterSettings(graph)
  return {
    material: buildMaterial(backend.tsl, result.output.slots, settings, graph, backend.uniforms),
    uniforms: backend.uniforms,
    properties: backend.properties,
    missingTextures: [...backend.missingTextures],
    surface: settings.surface,
    errors: [],
  }
}
