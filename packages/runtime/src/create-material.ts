import { MASTER_NODE_ID, MASTER_SLOTS, compile, portKey } from '@nudo-tsl/core'
import type { CompileError, Graph, MasterSlot, NodeRegistry, PortKey } from '@nudo-tsl/core'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { createLiveBackend } from './live-backend'
import type { LiveUniform } from './live-backend'
import type { LiveNode } from './live-facade'

export interface MaterialBuild {
  /** `null` when compilation failed. */
  readonly material: MeshStandardNodeMaterial | null
  readonly uniforms: ReadonlyMap<PortKey, LiveUniform>
  readonly errors: readonly CompileError[]
}

type MaterialNodeProperty =
  | 'positionNode'
  | 'colorNode'
  | 'emissiveNode'
  | 'metalnessNode'
  | 'roughnessNode'
  | 'normalNode'
  | 'opacityNode'

const SLOT_PROPERTIES: Readonly<Record<MasterSlot, MaterialNodeProperty>> = {
  position: 'positionNode',
  baseColor: 'colorNode',
  emission: 'emissiveNode',
  metalness: 'metalnessNode',
  roughness: 'roughnessNode',
  normal: 'normalNode',
  opacity: 'opacityNode',
}

const OPACITY_INPUT = portKey({ nodeId: MASTER_NODE_ID, portId: 'opacity' })

const isOpacityConnected = (graph: Graph): boolean =>
  Object.values(graph.edges).some((edge) => portKey(edge.to) === OPACITY_INPUT)

function buildMaterial(
  slots: Partial<Record<MasterSlot, LiveNode>>,
  graph: Graph,
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial()
  for (const slot of MASTER_SLOTS) {
    const expression = slots[slot]
    if (expression === undefined) continue
    // Object.assign sidesteps @types/three's per-node-type property types, which cannot be
    // satisfied by a type-erased LiveNode (the graph's types are only known at runtime).
    Object.assign(material, { [SLOT_PROPERTIES[slot]]: expression })
  }
  material.transparent = isOpacityConnected(graph)
  return material
}

/** Compiles the graph's master stack into a node material plus its live inline uniforms. */
export function createMaterial(graph: Graph, registry: NodeRegistry): MaterialBuild {
  const backend = createLiveBackend()
  const result = compile(graph, registry, backend, { kind: 'master' })
  if (!result.ok) return { material: null, uniforms: new Map(), errors: result.errors }
  if (result.output.kind !== 'master') {
    const errors: CompileError[] = [
      {
        nodeId: MASTER_NODE_ID,
        code: 'build-failed',
        message: 'Compiler returned no master output',
      },
    ]
    return { material: null, uniforms: new Map(), errors }
  }
  return {
    material: buildMaterial(result.output.slots, graph),
    uniforms: backend.uniforms,
    errors: [],
  }
}
