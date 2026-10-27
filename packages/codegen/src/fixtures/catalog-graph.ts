import {
  MASTER_NODE_ID,
  addNode,
  addProperty,
  addPropertyNode,
  asEdgeId,
  asNodeId,
  asPropertyId,
  connect,
  createGraph,
  float,
  setParam,
  vec2,
  vec3,
  vec4,
} from '@nudo-tsl/core'
import type {
  AnyNodeDefinition,
  BlackboardProperty,
  Graph,
  NodeRegistry,
  ParamValue,
  PortRef,
} from '@nudo-tsl/core'
import { unwrap } from './unwrap'

const ORIGIN = { x: 0, y: 0 }
const MASTER_TYPE = 'master/stack'
const SUM_TYPE = 'math/add'
const SAMPLE_TEXTURE_TYPE = 'texture/sample-texture-2d'

/** Which node type feeds which master slot, besides the sum that feeds the colors. */
const SLOT_SOURCES: Readonly<Record<string, string>> = {
  position: 'input/position',
  normal: 'normal/normal-from-height',
  opacity: 'scene/depth-fade',
  alphaClip: 'effects/gradient',
  roughness: 'math/sin',
  metalness: 'input/float',
}

type ParamOverrides = Readonly<Record<string, ParamValue>>

const PROPERTIES: readonly BlackboardProperty[] = [
  {
    id: asPropertyId('prop-speed'),
    label: 'Wave Speed',
    name: 'waveSpeed',
    exposed: true,
    type: 'float',
    value: float(1.5),
  },
  {
    id: asPropertyId('prop-offset'),
    label: 'Offset',
    name: 'offset',
    exposed: false,
    type: 'vec2',
    value: vec2(0.25, 0.75),
  },
  {
    id: asPropertyId('prop-tint'),
    label: 'Tint',
    name: 'tint',
    exposed: true,
    type: 'vec3',
    widget: 'color',
    value: vec3(0.5, 0.25, 0.125),
  },
  {
    id: asPropertyId('prop-bounds'),
    label: 'Bounds',
    name: 'bounds',
    exposed: true,
    type: 'vec4',
    value: vec4(0, 0.5, 1, 2),
  },
  {
    id: asPropertyId('prop-albedo'),
    label: 'Albedo',
    name: 'albedo',
    exposed: true,
    type: 'texture',
    value: { type: 'texture', assetId: null },
  },
  {
    id: asPropertyId('prop-mask'),
    label: 'Mask',
    name: 'mask',
    exposed: false,
    type: 'texture',
    value: { type: 'texture', assetId: null },
  },
]

/** One override set per enum option, so every option of every node is printed at least once. */
function enumVariants(definition: AnyNodeDefinition): readonly ParamOverrides[] {
  const variants = (definition.params ?? []).flatMap((param) =>
    param.kind === 'enum' ? param.options.map((option) => ({ [param.id]: option.value })) : [],
  )
  return variants.length > 0 ? variants : [{}]
}

const firstVectorOutput = (definition: AnyNodeDefinition): string | undefined =>
  definition.outputs.find(
    (output) => output.type.kind !== 'concrete' || output.type.type !== 'texture',
  )?.id

/**
 * A graph that contains every catalog node (every enum option of it, too), fully wired to the
 * master: all vector outputs are summed into the colors, and a few nodes also feed the other slots.
 * It exists so codegen can be checked against the whole catalog at once.
 */
export function createCatalogGraph(registry: NodeRegistry): Graph {
  let graph = createGraph()
  let nodeCount = 0
  let edgeCount = 0
  const sources: PortRef[] = []
  const sourceByType = new Map<string, PortRef>()
  const textureReaders: PortRef[] = []

  const link = (from: PortRef, to: PortRef): void => {
    edgeCount += 1
    graph = unwrap(
      connect(graph, registry, { id: asEdgeId(`edge-${String(edgeCount)}`), from, to }),
    )
  }

  const nextNodeId = (type: string) => {
    nodeCount += 1
    return asNodeId(`${type.replaceAll('/', '-')}-${String(nodeCount)}`)
  }

  const registerSource = (type: string, ref: PortRef): void => {
    sources.push(ref)
    if (!sourceByType.has(type)) sourceByType.set(type, ref)
  }

  for (const property of PROPERTIES) graph = unwrap(addProperty(graph, property))

  for (const property of PROPERTIES) {
    const id = nextNodeId(`property-${property.name}`)
    graph = unwrap(
      addPropertyNode(graph, registry, { id, propertyId: property.id, position: ORIGIN }),
    )
    const out: PortRef = { nodeId: id, portId: 'out' }
    if (property.type === 'texture') textureReaders.push(out)
    else registerSource(`property/${property.type}`, out)
  }

  for (const definition of registry.list()) {
    if (definition.type === MASTER_TYPE || definition.reads === 'property') continue
    for (const overrides of enumVariants(definition)) {
      const id = nextNodeId(definition.type)
      graph = unwrap(addNode(graph, registry, { id, type: definition.type, position: ORIGIN }))
      for (const [paramId, value] of Object.entries(overrides)) {
        graph = unwrap(setParam(graph, registry, { nodeId: id, paramId }, value))
      }
      const outputId = firstVectorOutput(definition)
      if (outputId !== undefined) registerSource(definition.type, { nodeId: id, portId: outputId })
      if (definition.type === SAMPLE_TEXTURE_TYPE) {
        // The first samplers read texture properties; the rest keep their own inline texture.
        const reader = textureReaders.shift()
        if (reader !== undefined) link(reader, { nodeId: id, portId: 'texture' })
      }
    }
  }

  let sum: PortRef | undefined
  for (const source of sources) {
    if (sum === undefined) {
      sum = source
      continue
    }
    const id = nextNodeId(SUM_TYPE)
    graph = unwrap(addNode(graph, registry, { id, type: SUM_TYPE, position: ORIGIN }))
    link(sum, { nodeId: id, portId: 'a' })
    link(source, { nodeId: id, portId: 'b' })
    sum = { nodeId: id, portId: 'out' }
  }
  if (sum === undefined) throw new Error('The registry holds no node that produces a vector')

  link(sum, { nodeId: MASTER_NODE_ID, portId: 'baseColor' })
  link(sum, { nodeId: MASTER_NODE_ID, portId: 'emission' })
  for (const [slot, type] of Object.entries(SLOT_SOURCES)) {
    const source = sourceByType.get(type)
    if (source !== undefined) link(source, { nodeId: MASTER_NODE_ID, portId: slot })
  }
  return graph
}
