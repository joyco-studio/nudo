import { describe, expect, it } from 'vitest'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
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
import { removeProperty } from './remove-property'
import { renameProperty } from './rename-property'
import { setParam } from './set-param'
import { setPropertyExposed } from './set-property-exposed'
import { setPropertyLabel } from './set-property-label'
import { setPropertyValue } from './set-property-value'

const propertyFloat = defineNode({
  type: 'property/float',
  category: 'input',
  label: 'Float property',
  description: 'Reads a float property',
  keywords: [],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  params: [{ id: 'propertyId', label: 'Property', kind: 'string', default: '', hidden: true }],
  reads: 'property',
  build: ({ tsl }) => ({ out: tsl.construct('float', [0]) }),
})

const propertyVec3 = defineNode({
  type: 'property/vec3',
  category: 'input',
  label: 'Vec3 property',
  description: 'Reads a vec3 property',
  keywords: [],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
  params: [{ id: 'propertyId', label: 'Property', kind: 'string', default: '', hidden: true }],
  reads: 'property',
  build: ({ tsl }) => ({ out: tsl.construct('vec3', [0, 0, 0]) }),
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
;[master, pass, propertyFloat, propertyVec3].forEach((definition) => registry.register(definition))

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const unwrapError = <T, E>(result: Result<T, E>): E => {
  if (result.ok) throw new Error('Expected a failure')
  return result.error
}

const speedId = asPropertyId('p-speed')
const tintId = asPropertyId('p-tint')

const speed: BlackboardProperty = {
  id: speedId,
  label: 'Wave speed',
  name: 'waveSpeed',
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

const graphWithProperties = (): Graph =>
  unwrap(addProperty(unwrap(addProperty(createGraph(), speed)), tint))

describe('addProperty', () => {
  it('appends the property', () => {
    expect(graphWithProperties().properties).toEqual([speed, tint])
  })

  it('rejects an invalid name', () => {
    expect(unwrapError(addProperty(createGraph(), { ...speed, name: '2x' }))).toEqual({
      code: 'invalid-name',
      name: '2x',
    })
  })

  it('rejects a duplicate name, even with a different label and id', () => {
    const duplicate = { ...tint, id: asPropertyId('other'), name: 'waveSpeed' }

    expect(unwrapError(addProperty(graphWithProperties(), duplicate))).toEqual({
      code: 'duplicate-name',
      name: 'waveSpeed',
    })
  })

  it('rejects a duplicate id', () => {
    const duplicate = { ...tint, id: speedId }

    expect(unwrapError(addProperty(graphWithProperties(), duplicate))).toEqual({
      code: 'duplicate-id',
      id: speedId,
    })
  })

  it('rejects a value that does not match the declared type', () => {
    expect(unwrapError(addProperty(createGraph(), { ...speed, value: vec3(0, 0, 0) }))).toEqual({
      code: 'type-mismatch',
    })
  })
})

describe('renameProperty', () => {
  it('changes only the reference name', () => {
    const graph = unwrap(renameProperty(graphWithProperties(), speedId, 'windSpeed'))

    expect(graph.properties).toEqual([{ ...speed, name: 'windSpeed' }, tint])
  })

  it('rejects a duplicate name and leaves the graph unchanged', () => {
    const graph = graphWithProperties()
    const result = renameProperty(graph, speedId, 'tint')

    expect(unwrapError(result)).toEqual({ code: 'duplicate-name', name: 'tint' })
    expect(graph.properties).toEqual([speed, tint])
  })

  it('accepts renaming a property to its own name', () => {
    expect(renameProperty(graphWithProperties(), speedId, 'waveSpeed').ok).toBe(true)
  })

  it('rejects an invalid name', () => {
    expect(unwrapError(renameProperty(graphWithProperties(), speedId, 'my var'))).toEqual({
      code: 'invalid-name',
      name: 'my var',
    })
    expect(unwrapError(renameProperty(graphWithProperties(), speedId, 'class'))).toEqual({
      code: 'invalid-name',
      name: 'class',
    })
  })

  it('rejects an unknown property', () => {
    const missing = asPropertyId('missing')

    expect(unwrapError(renameProperty(graphWithProperties(), missing, 'x'))).toEqual({
      code: 'property-not-found',
      id: missing,
    })
  })
})

describe('setPropertyLabel and setPropertyExposed', () => {
  it('updates the label without touching the name', () => {
    const graph = unwrap(setPropertyLabel(graphWithProperties(), speedId, 'Speed of waves'))

    expect(graph.properties[0]).toEqual({ ...speed, label: 'Speed of waves' })
  })

  it('toggles exposed', () => {
    const graph = unwrap(setPropertyExposed(graphWithProperties(), tintId, false))

    expect(graph.properties[1]).toEqual({ ...tint, exposed: false })
  })

  it('reports an unknown property', () => {
    const missing = asPropertyId('missing')

    expect(unwrapError(setPropertyLabel(createGraph(), missing, 'x'))).toEqual({
      code: 'property-not-found',
      id: missing,
    })
    expect(unwrapError(setPropertyExposed(createGraph(), missing, true))).toEqual({
      code: 'property-not-found',
      id: missing,
    })
  })
})

describe('setPropertyValue', () => {
  it('replaces the value', () => {
    const graph = unwrap(setPropertyValue(graphWithProperties(), speedId, float(2.5)))

    expect(graph.properties[0]).toEqual({ ...speed, value: float(2.5) })
  })

  it('rejects a value of the wrong type', () => {
    const graph = graphWithProperties()

    expect(unwrapError(setPropertyValue(graph, speedId, vec3(1, 1, 1)))).toEqual({
      code: 'type-mismatch',
    })
    expect(graph.properties[0]).toEqual(speed)
  })

  it('reports an unknown property', () => {
    const missing = asPropertyId('missing')

    expect(unwrapError(setPropertyValue(createGraph(), missing, float(1)))).toEqual({
      code: 'property-not-found',
      id: missing,
    })
  })
})

describe('removeProperty', () => {
  const position = { x: 0, y: 0 }

  const graphWithReaders = (): Graph => {
    let graph = graphWithProperties()
    graph = unwrap(
      addPropertyNode(graph, registry, { id: asNodeId('reader'), propertyId: speedId, position }),
    )
    graph = unwrap(
      addPropertyNode(graph, registry, { id: asNodeId('other'), propertyId: tintId, position }),
    )
    graph = unwrap(addNode(graph, registry, { id: asNodeId('keep'), type: 'test/pass', position }))
    graph = unwrap(
      connect(graph, registry, {
        id: asEdgeId('e-reader'),
        from: { nodeId: asNodeId('reader'), portId: 'out' },
        to: { nodeId: asNodeId('keep'), portId: 'a' },
      }),
    )
    graph = unwrap(
      connect(graph, registry, {
        id: asEdgeId('e-keep'),
        from: { nodeId: asNodeId('keep'), portId: 'out' },
        to: { nodeId: MASTER_NODE_ID, portId: 'roughness' },
      }),
    )
    return graph
  }

  it('removes the property, its property nodes and their edges in one operation', () => {
    const graph = unwrap(removeProperty(graphWithReaders(), speedId))

    expect(graph.properties).toEqual([tint])
    expect(Object.keys(graph.nodes).sort()).toEqual(['keep', 'master', 'other'])
    expect(Object.keys(graph.edges)).toEqual(['e-keep'])
  })

  it('reports an unknown property', () => {
    const missing = asPropertyId('missing')

    expect(unwrapError(removeProperty(graphWithReaders(), missing))).toEqual({
      code: 'property-not-found',
      id: missing,
    })
  })
})

describe('addPropertyNode', () => {
  const position = { x: 3, y: 4 }

  it('adds the reader that matches the property type, with propertyId set', () => {
    const graph = graphWithProperties()
    const withFloat = unwrap(
      addPropertyNode(graph, registry, { id: asNodeId('r1'), propertyId: speedId, position }),
    )
    const withVec3 = unwrap(
      addPropertyNode(withFloat, registry, { id: asNodeId('r2'), propertyId: tintId, position }),
    )

    expect(withVec3.nodes[asNodeId('r1')]).toEqual({
      id: asNodeId('r1'),
      type: 'property/float',
      position,
      inputValues: {},
      params: { propertyId: speedId },
    })
    expect(withVec3.nodes[asNodeId('r2')]?.type).toBe('property/vec3')
    expect(withVec3.nodes[asNodeId('r2')]?.params).toEqual({ propertyId: tintId })
  })

  it('rejects an unknown property', () => {
    const missing = asPropertyId('missing')
    const input = { id: asNodeId('r1'), propertyId: missing, position }

    expect(unwrapError(addPropertyNode(graphWithProperties(), registry, input))).toEqual({
      code: 'property-not-found',
      id: missing,
    })
  })

  it('rejects a property whose reader type is not registered', () => {
    const vec2Property: BlackboardProperty = {
      ...speed,
      id: asPropertyId('p-uv'),
      name: 'uvOffset',
      type: 'vec2',
      value: { type: 'vec2', value: [0, 0] },
    }
    const graph = unwrap(addProperty(createGraph(), vec2Property))
    const input = { id: asNodeId('r1'), propertyId: vec2Property.id, position }

    expect(unwrapError(addPropertyNode(graph, registry, input))).toEqual({
      code: 'unknown-node-type',
      type: 'property/vec2',
    })
  })

  it('rejects a duplicate node id', () => {
    const first = { id: asNodeId('r1'), propertyId: speedId, position }
    const graph = unwrap(addPropertyNode(graphWithProperties(), registry, first))

    expect(unwrapError(addPropertyNode(graph, registry, { ...first, propertyId: tintId }))).toEqual(
      {
        code: 'duplicate-id',
        id: 'r1',
      },
    )
  })

  it('makes addNode reject reader definitions', () => {
    const input = { id: asNodeId('r1'), type: 'property/float', position }

    expect(unwrapError(addNode(graphWithProperties(), registry, input))).toEqual({
      code: 'property-required',
    })
  })
})

describe('setParam on property readers', () => {
  const readerId = asNodeId('reader')
  const ref = { nodeId: readerId, paramId: 'propertyId' }
  const graphWithReader = (): Graph =>
    unwrap(
      addPropertyNode(graphWithProperties(), registry, {
        id: readerId,
        propertyId: speedId,
        position: { x: 0, y: 0 },
      }),
    )

  it('rejects a propertyId that is not in the Blackboard', () => {
    expect(unwrapError(setParam(graphWithReader(), registry, ref, 'ghost'))).toEqual({
      code: 'property-not-found',
      id: 'ghost',
    })
  })

  it('accepts re-pointing the reader at an existing property', () => {
    const graph = unwrap(setParam(graphWithReader(), registry, ref, tintId))

    expect(graph.nodes[readerId]?.params).toEqual({ propertyId: tintId })
  })
})
