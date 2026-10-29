import {
  DEFAULT_MASTER_SETTINGS,
  MASTER_NODE_ID,
  compile,
  isOpacityConnected,
  masterMaterialAssignments,
  outlineMaterialAssignments,
  portKey,
  readMasterSettings,
  resolveTransparency,
} from '@nudo-tsl/core'
import type {
  CompileError,
  Graph,
  MasterLighting,
  MaterialAssignment,
  MasterSettings,
  MasterSlot,
  MasterSurface,
  NodeRegistry,
  PortKey,
  PropertyId,
  TslFacade,
} from '@nudo-tsl/core'
import { BackSide, DoubleSide, FrontSide } from 'three'
import {
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
} from 'three/webgpu'
import { createLiveBackend } from './live-backend'
import type { LiveProperty, LiveUniform } from './live-backend'
import type { LiveNode } from './live-facade'
import type { MaterialOptions } from './texture-resolution'

export type RuntimeMaterial =
  MeshStandardNodeMaterial | MeshBasicNodeMaterial | MeshPhysicalNodeMaterial

/** The inverted-hull pass: the mesh drawn again, back faces only, in one flat color. */
export type OutlineMaterial = MeshBasicNodeMaterial

export interface MaterialBuild {
  /** `null` when compilation failed. */
  readonly material: RuntimeMaterial | null
  /**
   * The outline pass, drawn with the same geometry after `material`; `null` while the master's
   * Outline is off or compilation failed. It reads the same uniforms, so a value edit moves both.
   */
  readonly outline: OutlineMaterial | null
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
  outline: null,
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

function materialFor(lighting: MasterLighting): RuntimeMaterial {
  if (lighting === 'unlit') return new MeshBasicNodeMaterial()
  if (lighting === 'physical') return new MeshPhysicalNodeMaterial()
  return new MeshStandardNodeMaterial()
}

/**
 * Sets each node property. Object.assign sidesteps @types/three's per-node-type property types,
 * which cannot be satisfied by a type-erased LiveNode (the graph's types are only known at runtime).
 */
function assignNodes(
  material: RuntimeMaterial,
  assignments: readonly MaterialAssignment<LiveNode>[],
): void {
  for (const { property, expression } of assignments) {
    Object.assign(material, { [property]: expression })
  }
}

function buildMaterial(
  tsl: LiveFacade,
  slots: MasterSlots,
  settings: MasterSettings,
  graph: Graph,
  uniforms: ReadonlyMap<PortKey, LiveUniform>,
): RuntimeMaterial {
  const material = materialFor(settings.lighting)
  assignNodes(material, masterMaterialAssignments(tsl, slots, settings))
  material.side = settings.twoSided ? DoubleSide : FrontSide
  material.transparent = resolveTransparency({
    surface: settings.surface,
    opacityConnected: isOpacityConnected(graph),
    inlineOpacity: inlineOpacityOf(uniforms),
  })
  return material
}

/**
 * The outline pass for `surface`, or `null` while the outline is off. Opaque and unlit whatever
 * the surface is; it fogs and tone maps like the surface so both sit in the same scene.
 */
function buildOutline(
  tsl: LiveFacade,
  slots: MasterSlots,
  settings: MasterSettings,
  surface: RuntimeMaterial,
): OutlineMaterial | null {
  const assignments = outlineMaterialAssignments(tsl, slots, settings)
  if (assignments.length === 0) return null
  const outline = new MeshBasicNodeMaterial()
  assignNodes(outline, assignments)
  outline.side = BackSide
  outline.fog = surface.fog
  outline.toneMapped = surface.toneMapped
  return outline
}

/**
 * Compiles the graph's master stack into a node material (and its outline pass, when on) plus
 * their live inline uniforms.
 */
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
  const { slots } = result.output
  const material = buildMaterial(backend.tsl, slots, settings, graph, backend.uniforms)
  return {
    material,
    outline: buildOutline(backend.tsl, slots, settings, material),
    uniforms: backend.uniforms,
    properties: backend.properties,
    missingTextures: [...backend.missingTextures],
    surface: settings.surface,
    errors: [],
  }
}
