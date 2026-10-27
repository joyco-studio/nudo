import {
  DEFAULT_MASTER_SETTINGS,
  MASTER_NODE_ID,
  compile,
  isOpacityConnected,
  masterMaterialAssignments,
  portKey,
  readMasterSettings,
  resolveTransparency,
} from '@nudo-tsl/core'
import type {
  CompileError,
  Graph,
  MasterSettings,
  MasterSlot,
  MasterSurface,
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
type LiveFacade = TslFacade<LiveNode>

export const OPACITY_INPUT: PortKey = portKey({ nodeId: MASTER_NODE_ID, portId: 'opacity' })

/** An unconnected opacity reads from a uniform; a connected one has none and is always blended. */
function inlineOpacityOf(uniforms: ReadonlyMap<PortKey, LiveUniform>): number | null {
  const inlineOpacity = uniforms.get(OPACITY_INPUT)?.value
  return typeof inlineOpacity === 'number' ? inlineOpacity : null
}

function buildMaterial(
  tsl: LiveFacade,
  slots: MasterSlots,
  settings: MasterSettings,
  graph: Graph,
  uniforms: ReadonlyMap<PortKey, LiveUniform>,
): RuntimeMaterial {
  const material =
    settings.lighting === 'unlit' ? new MeshBasicNodeMaterial() : new MeshStandardNodeMaterial()
  for (const { property, expression } of masterMaterialAssignments(tsl, slots, settings.lighting)) {
    // Object.assign sidesteps @types/three's per-node-type property types, which cannot be
    // satisfied by a type-erased LiveNode (the graph's types are only known at runtime).
    Object.assign(material, { [property]: expression })
  }
  material.side = settings.twoSided ? DoubleSide : FrontSide
  material.transparent = resolveTransparency({
    surface: settings.surface,
    opacityConnected: isOpacityConnected(graph),
    inlineOpacity: inlineOpacityOf(uniforms),
  })
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
  const settings = readMasterSettings(graph, registry)
  return {
    material: buildMaterial(backend.tsl, result.output.slots, settings, graph, backend.uniforms),
    uniforms: backend.uniforms,
    properties: backend.properties,
    missingTextures: [...backend.missingTextures],
    surface: settings.surface,
    errors: [],
  }
}
