import { describe, expect, it } from 'vitest'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
import type { Graph, PortRef } from '../types/graph'
import type { Result } from '../types/result'
import { MASTER_NODE_ID, asEdgeId, asNodeId } from '../types/ids'
import { concrete, float, generic, vec3 } from '../values/port-value-factories'
import { addNode } from './add-node'
import { connect } from './connect'
import { createGraph } from './create-graph'
import { disconnect } from './disconnect'
import { moveNodes } from './move-nodes'
import { removeNodes } from './remove-nodes'
import { setInputValue } from './set-input-value'

const floatSource = defineNode({
  type: 'test/float-source',
  category: 'input',
  label: 'Float source',
  description: 'Concrete float output',
  keywords: [],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  build: ({ tsl }) => ({ out: tsl.construct('float', [0]) }),
})

const pass = defineNode({
  type: 'test/pass',
  category: 'utility',
  label: 'Pass',
  description: 'Generic pass-through',
  keywords: [],
  inputs: [{ id: 'a', label: 'A', type: generic('T'), default: float(0) }],
  outputs: [{ id: 'out', label: 'Out', type: generic('T') }],
  build: ({ inputs }) => ({ out: inputs.a }),
})

const master = defineNode({
  type: 'master/stack',
  category: 'master',
  label: 'Master',
  description: 'Master output',
  keywords: [],
  inputs: [
    { id: 'baseColor', label: 'Base color', type: concrete('vec3'), default: vec3(1, 1, 1) },
  ],
  outputs: [],
  build: () => ({}),
})

const createRegistry = () => {
  const registry = createNodeRegistry()
  ;[floatSource, pass, master].forEach((definition) => registry.register(definition))
  return registry
}

const registry = createRegistry()
const position = { x: 10, y: 20 }
const ref = (nodeId: string, portId: string): PortRef => ({ nodeId: asNodeId(nodeId), portId })

const unwrap = <T>(result: Result<T, unknown>): T => {
  if (!result.ok) throw new Error(`expected ok result, got ${JSON.stringify(result.error)}`)
  return result.value
}

const withNodes = (): Graph => {
  const withSource = unwrap(
    addNode(createGraph(), registry, { id: asNodeId('src'), type: 'test/float-source', position }),
  )
  return unwrap(addNode(withSource, registry, { id: asNodeId('p'), type: 'test/pass', position }))
}

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  Object.values(value).forEach(deepFreeze)
  return Object.freeze(value)
}

describe('createGraph', () => {
  it('contains only the master node', () => {
    expect(createGraph()).toEqual({
      schemaVersion: 1,
      nodes: {
        master: {
          id: 'master',
          type: 'master/stack',
          position: { x: 600, y: 0 },
          inputValues: {},
          params: {},
        },
      },
      edges: {},
      properties: [],
    })
  })
})

describe('addNode', () => {
  it('adds a node with empty input values and params', () => {
    const graph = unwrap(
      addNode(createGraph(), registry, { id: asNodeId('p'), type: 'test/pass', position }),
    )

    expect(graph.nodes[asNodeId('p')]).toEqual({
      id: 'p',
      type: 'test/pass',
      position,
      inputValues: {},
      params: {},
    })
  })

  it('rejects an unknown type', () => {
    const result = addNode(createGraph(), registry, {
      id: asNodeId('x'),
      type: 'test/missing',
      position,
    })

    expect(result).toEqual({
      ok: false,
      error: { code: 'unknown-node-type', type: 'test/missing' },
    })
  })

  it('rejects a duplicate id', () => {
    const result = addNode(withNodes(), registry, {
      id: asNodeId('p'),
      type: 'test/pass',
      position,
    })

    expect(result).toEqual({ ok: false, error: { code: 'duplicate-id', id: 'p' } })
  })
})

describe('removeNodes', () => {
  it('rejects master and leaves the graph unchanged', () => {
    const graph = withNodes()

    const result = removeNodes(graph, [asNodeId('p'), MASTER_NODE_ID])

    expect(result).toEqual({ ok: false, error: { code: 'cannot-remove-master' } })
    expect(graph).toEqual(withNodes())
  })

  it('rejects unknown ids', () => {
    expect(removeNodes(withNodes(), [asNodeId('ghost')])).toEqual({
      ok: false,
      error: { code: 'node-not-found', nodeId: 'ghost' },
    })
  })

  it('deletes touching edges', () => {
    const connected = unwrap(
      connect(withNodes(), registry, {
        id: asEdgeId('e1'),
        from: ref('src', 'out'),
        to: ref('p', 'a'),
      }),
    )
    const withMasterEdge = unwrap(
      connect(connected, registry, {
        id: asEdgeId('e2'),
        from: ref('p', 'out'),
        to: ref('master', 'baseColor'),
      }),
    )

    const graph = unwrap(removeNodes(withMasterEdge, [asNodeId('p')]))

    expect(Object.keys(graph.nodes).sort()).toEqual(['master', 'src'])
    expect(graph.edges).toEqual({})
  })
})

describe('moveNodes', () => {
  it('moves existing nodes and ignores unknown ids', () => {
    const graph = moveNodes(withNodes(), {
      [asNodeId('p')]: { x: 1, y: 2 },
      [asNodeId('ghost')]: { x: 9, y: 9 },
    })

    expect(graph.nodes[asNodeId('p')]?.position).toEqual({ x: 1, y: 2 })
    expect(graph.nodes[asNodeId('src')]?.position).toEqual(position)
    expect(Object.keys(graph.nodes)).not.toContain('ghost')
  })
})

describe('setInputValue', () => {
  it('stores the value on the node', () => {
    const graph = unwrap(setInputValue(withNodes(), ref('p', 'a'), float(3)))

    expect(graph.nodes[asNodeId('p')]?.inputValues).toEqual({ a: float(3) })
  })

  it('rejects an unknown node', () => {
    expect(setInputValue(withNodes(), ref('ghost', 'a'), float(3))).toEqual({
      ok: false,
      error: { code: 'node-not-found', nodeId: 'ghost' },
    })
  })
})

describe('connect', () => {
  it('replaces the existing edge on the same input', () => {
    const withSecondSource = unwrap(
      addNode(withNodes(), registry, {
        id: asNodeId('src2'),
        type: 'test/float-source',
        position,
      }),
    )
    const first = unwrap(
      connect(withSecondSource, registry, {
        id: asEdgeId('e1'),
        from: ref('src', 'out'),
        to: ref('p', 'a'),
      }),
    )

    const second = unwrap(
      connect(first, registry, {
        id: asEdgeId('e2'),
        from: ref('src2', 'out'),
        to: ref('p', 'a'),
      }),
    )

    expect(Object.keys(second.edges)).toEqual(['e2'])
    expect(second.edges[asEdgeId('e2')]?.from).toEqual(ref('src2', 'out'))
  })

  it('maps a rejection to invalid-connection', () => {
    const result = connect(withNodes(), registry, {
      id: asEdgeId('e1'),
      from: ref('src', 'out'),
      to: ref('src', 'out'),
    })

    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid-connection', reason: 'same-node' },
    })
  })

  it('allows a replacement that would only cycle through the replaced edge', () => {
    const connected = unwrap(
      connect(withNodes(), registry, {
        id: asEdgeId('e1'),
        from: ref('src', 'out'),
        to: ref('p', 'a'),
      }),
    )

    const result = connect(connected, registry, {
      id: asEdgeId('e2'),
      from: ref('src', 'out'),
      to: ref('p', 'a'),
    })

    expect(Object.keys(unwrap(result).edges)).toEqual(['e2'])
  })
})

describe('disconnect', () => {
  it('removes edges by id and ignores unknown ids', () => {
    const connected = unwrap(
      connect(withNodes(), registry, {
        id: asEdgeId('e1'),
        from: ref('src', 'out'),
        to: ref('p', 'a'),
      }),
    )

    expect(disconnect(connected, [asEdgeId('e1'), asEdgeId('ghost')]).edges).toEqual({})
  })
})

describe('purity', () => {
  it('operations never mutate the input graph', () => {
    const graph = deepFreeze(withNodes())
    const connected = deepFreeze(
      unwrap(
        connect(graph, registry, {
          id: asEdgeId('e1'),
          from: ref('src', 'out'),
          to: ref('p', 'a'),
        }),
      ),
    )

    expect(() => {
      addNode(connected, registry, { id: asNodeId('n'), type: 'test/pass', position })
      removeNodes(connected, [asNodeId('p')])
      removeNodes(connected, [MASTER_NODE_ID])
      moveNodes(connected, { [asNodeId('p')]: { x: 5, y: 5 } })
      setInputValue(connected, ref('p', 'a'), float(2))
      connect(connected, registry, {
        id: asEdgeId('e2'),
        from: ref('src', 'out'),
        to: ref('p', 'a'),
      })
      disconnect(connected, [asEdgeId('e1')])
    }).not.toThrow()
  })
})
