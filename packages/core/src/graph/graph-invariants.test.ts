import { describe, expect, it } from 'vitest'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
import { parseGraph } from '../serialization/parse-graph'
import { serializeGraph } from '../serialization/serialize-graph'
import type { BlackboardProperty } from '../types/blackboard-property'
import type { Graph } from '../types/graph'
import { MASTER_NODE_ID, asEdgeId, asNodeId, asPropertyId } from '../types/ids'
import type { Result } from '../types/result'
import { concrete, float, vec3 } from '../values/port-value-factories'
import { addNode } from './add-node'
import { addProperty } from './add-property'
import { addPropertyNode } from './add-property-node'
import { connect } from './connect'
import { createGraph } from './create-graph'
import { disconnect } from './disconnect'
import { moveNodes } from './move-nodes'
import { removeNodes } from './remove-nodes'
import { removeProperty } from './remove-property'
import { renameProperty } from './rename-property'
import { setInputValue } from './set-input-value'
import { setParam } from './set-param'
import { setPropertyExposed } from './set-property-exposed'
import { setPropertyLabel } from './set-property-label'
import { setPropertyValue } from './set-property-value'

const propertyReader = (type: 'float' | 'vec3') =>
  defineNode({
    type: `property/${type}`,
    category: 'input',
    label: `${type} property`,
    description: `Reads a ${type} property`,
    keywords: [],
    inputs: [],
    outputs: [{ id: 'out', label: 'Out', type: concrete(type) }],
    params: [{ id: 'propertyId', label: 'Property', kind: 'string', default: '', hidden: true }],
    reads: 'property',
    build: ({ tsl }) => ({ out: tsl.construct(type, type === 'float' ? [0] : [0, 0, 0]) }),
  })

const pass = defineNode({
  type: 'test/pass',
  category: 'utility',
  label: 'Pass',
  description: 'Float pass-through',
  keywords: [],
  inputs: [{ id: 'a', label: 'A', type: concrete('float'), default: float(0) }],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  build: ({ inputs }) => ({ out: inputs.a }),
})

const noise = defineNode({
  type: 'test/noise',
  category: 'texture',
  label: 'Noise',
  description: 'Noise with params',
  keywords: [],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  params: [
    {
      id: 'kind',
      label: 'Kind',
      kind: 'enum',
      options: [
        { value: 'simplex', label: 'Simplex' },
        { value: 'perlin', label: 'Perlin' },
      ],
      default: 'simplex',
    },
    { id: 'wrap', label: 'Wrap', kind: 'boolean', default: true },
  ],
  build: ({ tsl }) => ({ out: tsl.construct('float', [0]) }),
})

const master = defineNode({
  type: 'master/stack',
  category: 'master',
  label: 'Master',
  description: 'Master output',
  keywords: [],
  inputs: [{ id: 'roughness', label: 'Roughness', type: concrete('float'), default: float(0.5) }],
  outputs: [],
  build: () => ({}),
})

const registry = createNodeRegistry()
;[master, pass, noise, propertyReader('float'), propertyReader('vec3')].forEach((definition) =>
  registry.register(definition),
)

const speedId = asPropertyId('p-speed')
const tintId = asPropertyId('p-tint')
const origin = { x: 0, y: 0 }

const speed: BlackboardProperty = {
  id: speedId,
  label: 'Speed',
  name: 'speed',
  exposed: true,
  type: 'float',
  value: float(1),
}
const tint: BlackboardProperty = {
  id: tintId,
  label: 'Tint',
  name: 'tint',
  exposed: true,
  type: 'vec3',
  widget: 'color',
  value: vec3(1, 0, 0),
}

const node = (id: string) => asNodeId(id)

/** Every successful step maps a graph to a graph; failures are reported with their step name. */
type Step = readonly [name: string, apply: (graph: Graph) => Result<Graph, unknown>]

const asOk = (graph: Graph): Result<Graph, never> => ({ ok: true, value: graph })

const steps: readonly Step[] = [
  ['addProperty speed', (g) => addProperty(g, speed)],
  ['addProperty tint', (g) => addProperty(g, tint)],
  [
    'addNode pass',
    (g) => addNode(g, registry, { id: node('pass'), type: 'test/pass', position: origin }),
  ],
  [
    'addNode noise',
    (g) => addNode(g, registry, { id: node('noise'), type: 'test/noise', position: origin }),
  ],
  [
    'addPropertyNode speed',
    (g) =>
      addPropertyNode(g, registry, {
        id: node('speed-reader'),
        propertyId: speedId,
        position: origin,
      }),
  ],
  [
    'addPropertyNode tint',
    (g) =>
      addPropertyNode(g, registry, {
        id: node('tint-reader'),
        propertyId: tintId,
        position: origin,
      }),
  ],
  [
    'setParam noise kind',
    (g) => setParam(g, registry, { nodeId: node('noise'), paramId: 'kind' }, 'perlin'),
  ],
  [
    'setParam universal collapsed',
    (g) => setParam(g, registry, { nodeId: node('pass'), paramId: 'collapsed' }, true),
  ],
  [
    'setParam universal previewMode on master',
    (g) => setParam(g, registry, { nodeId: MASTER_NODE_ID, paramId: 'previewMode' }, '3d'),
  ],
  [
    'setParam reader to another property',
    (g) => setParam(g, registry, { nodeId: node('tint-reader'), paramId: 'propertyId' }, speedId),
  ],
  [
    'connect reader to pass',
    (g) =>
      connect(g, registry, {
        id: asEdgeId('e1'),
        from: { nodeId: node('speed-reader'), portId: 'out' },
        to: { nodeId: node('pass'), portId: 'a' },
      }),
  ],
  [
    'connect pass to master',
    (g) =>
      connect(g, registry, {
        id: asEdgeId('e2'),
        from: { nodeId: node('pass'), portId: 'out' },
        to: { nodeId: MASTER_NODE_ID, portId: 'roughness' },
      }),
  ],
  [
    'connect second reader to a fed input (replaces the edge)',
    (g) =>
      connect(g, registry, {
        id: asEdgeId('e3'),
        from: { nodeId: node('tint-reader'), portId: 'out' },
        to: { nodeId: node('pass'), portId: 'a' },
      }),
  ],
  ['setInputValue', (g) => setInputValue(g, { nodeId: node('pass'), portId: 'a' }, float(0.25))],
  ['moveNodes', (g) => asOk(moveNodes(g, { [node('pass')]: { x: 9, y: 9 } }))],
  ['renameProperty', (g) => renameProperty(g, speedId, 'windSpeed')],
  ['setPropertyLabel', (g) => setPropertyLabel(g, speedId, 'Wind speed')],
  ['setPropertyExposed', (g) => setPropertyExposed(g, tintId, false)],
  ['setPropertyValue', (g) => setPropertyValue(g, speedId, float(3))],
  ['disconnect', (g) => asOk(disconnect(g, [asEdgeId('e3')]))],
  ['removeProperty tint (no reader points at it anymore)', (g) => removeProperty(g, tintId)],
  ['removeProperty speed (both readers and their edges go)', (g) => removeProperty(g, speedId)],
  ['removeNodes noise', (g) => removeNodes(g, [node('noise')])],
]

describe('graph operation invariant', () => {
  it('every graph produced by a sequence of core ops is accepted by parseGraph', () => {
    let graph = createGraph()
    for (const [name, apply] of steps) {
      const result = apply(graph)
      if (!result.ok) throw new Error(`step "${name}" failed: ${JSON.stringify(result.error)}`)
      graph = result.value

      const parsed = parseGraph(serializeGraph(graph), registry)
      if (!parsed.ok) throw new Error(`after "${name}": ${JSON.stringify(parsed.error)}`)
      expect(parsed.value).toEqual(graph)
    }

    expect(Object.keys(graph.nodes).sort()).toEqual(['master', 'pass'])
    expect(Object.keys(graph.edges)).toEqual(['e2'])
    expect(graph.properties).toEqual([])
  })

  it('ops that would break the invariant are rejected and leave the graph unchanged', () => {
    const base = steps.slice(0, 6).reduce<Graph>((graph, [, apply]) => {
      const result = apply(graph)
      if (!result.ok) throw new Error('setup failed')
      return result.value
    }, createGraph())
    const rejected = [
      addNode(base, registry, { id: node('bare'), type: 'property/float', position: origin }),
      setParam(base, registry, { nodeId: node('speed-reader'), paramId: 'propertyId' }, 'ghost'),
      addPropertyNode(base, registry, {
        id: node('x'),
        propertyId: asPropertyId('ghost'),
        position: origin,
      }),
      renameProperty(base, speedId, 'tint'),
      setPropertyValue(base, speedId, vec3(0, 0, 0)),
    ]

    expect(rejected.map((result) => result.ok)).toEqual([false, false, false, false, false])
    expect(parseGraph(serializeGraph(base), registry).ok).toBe(true)
  })
})
