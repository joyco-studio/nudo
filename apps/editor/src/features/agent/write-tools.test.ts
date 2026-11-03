import { generateModule } from '@nudo-tsl/codegen'
import { MASTER_NODE_ID, asEdgeId, asNodeId, createGraph, float, ok } from '@nudo-tsl/core'
import type { NodeId } from '@nudo-tsl/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '@/store/editor-store'
import { registry } from '@/store/registry'
import { immediateChoreograph } from './choreography'
import type { Choreograph } from './choreography'
import type { NodeTouch, ToolContext } from './tool-context'
import { writeTools } from './write-tools'

const getState = () => useEditorStore.getState()
const historyLength = () => useEditorStore.temporal.getState().pastStates.length

interface Harness {
  context: ToolContext
  touches: NodeTouch[]
  calls: string[]
}

function createHarness(overrides: Partial<ToolContext> = {}): Harness {
  const touches: NodeTouch[] = []
  const calls: string[] = []
  const context: ToolContext = {
    agent: { sessionId: 's', name: 'agent' },
    choreograph: immediateChoreograph,
    onTouch: (touch) => touches.push(touch),
    lastTouched: () => touches.at(-1)?.nodeId ?? null,
    canWrite: () => ok(undefined),
    tidyUp: () => {
      calls.push('tidy')
      return Promise.resolve()
    },
    confirm: () => Promise.resolve(true),
    ...overrides,
  }
  return { context, touches, calls }
}

async function run(
  tool: keyof typeof writeTools,
  args: unknown,
  context: ToolContext = createHarness().context,
) {
  return writeTools[tool](args, context)
}

function field(result: Awaited<ReturnType<typeof run>>, key: string): string {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  const value: unknown = result.value
  if (typeof value !== 'object' || value === null) throw new Error('No result value')
  const entry: unknown = Object.entries(value).find(([name]) => name === key)?.[1]
  if (typeof entry !== 'string') throw new Error(`Missing ${key}`)
  return entry
}

async function addMath(position = { x: 0, y: 0 }): Promise<NodeId> {
  return asNodeId(field(await run('add_node', { type: 'math/add', position }), 'nodeId'))
}

beforeEach(() => {
  useEditorStore.setState({
    graph: createGraph(),
    selectedNodeIds: [],
    draftPositions: {},
    notice: null,
    errorsByNode: {},
  })
  useEditorStore.temporal.getState().clear()
})

describe('add_node', () => {
  it('adds one undo entry and returns the new id', async () => {
    const harness = createHarness()
    const result = await run(
      'add_node',
      { type: 'math/add', position: { x: 5, y: 6 } },
      harness.context,
    )

    expect(result.ok).toBe(true)
    const nodeId = asNodeId(field(result, 'nodeId'))
    expect(getState().graph.nodes[nodeId]?.position).toEqual({ x: 5, y: 6 })
    expect(historyLength()).toBe(1)
    expect(harness.touches).toEqual([{ nodeId, created: true }])
    expect(
      result.ok &&
        Array.isArray(Object.entries(result.value ?? {}).find(([k]) => k === 'errors')?.[1]),
    ).toBe(true)
  })

  it('without position does not overlap existing nodes', async () => {
    const first = await addMath({ x: -1000, y: 0 })
    await addMath(getState().graph.nodes[first]?.position)
    const result = await run('add_node', { type: 'math/add' })
    const added = asNodeId(field(result, 'nodeId'))

    const position = getState().graph.nodes[added]?.position
    for (const node of Object.values(getState().graph.nodes)) {
      if (node.id === added) continue
      expect(node.position).not.toEqual(position)
    }
  })

  it('places near the last touched node', async () => {
    const anchor = await addMath({ x: 900, y: 300 })
    const harness = createHarness({ lastTouched: () => anchor })
    const result = await run('add_node', { type: 'math/add' }, harness.context)
    const added = asNodeId(field(result, 'nodeId'))

    expect(getState().graph.nodes[added]?.position.y).toBe(300)
    expect(getState().graph.nodes[added]?.position.x).toBeLessThan(900)
  })

  it('rejects an unknown type and the master type without touching the graph', async () => {
    const before = getState().graph

    expect(await run('add_node', { type: 'nope/nothing' })).toMatchObject({
      ok: false,
      error: { code: 'invalid' },
    })
    expect(await run('add_node', { type: 'master/stack' })).toMatchObject({
      ok: false,
      error: { code: 'invalid' },
    })
    expect(getState().graph).toBe(before)
  })

  it('waits for the cursor to arrive before it edits the graph', async () => {
    let release: () => void = () => undefined
    const arrive = vi.fn(() => new Promise<void>((resolve) => (release = resolve)))
    const settle = vi.fn()
    const choreograph: Choreograph = { arrive, settle }
    const before = getState().graph

    const pending = run(
      'add_node',
      { type: 'math/add', position: { x: 1, y: 2 } },
      createHarness({ choreograph }).context,
    )
    await Promise.resolve()

    expect(arrive).toHaveBeenCalledWith(
      { kind: 'point', position: { x: 1, y: 2 } },
      { ghost: { type: 'math/add', position: { x: 1, y: 2 } } },
    )
    expect(getState().graph).toBe(before)

    release()
    await pending

    expect(getState().graph).not.toBe(before)
    expect(settle).toHaveBeenCalledTimes(1)
  })
})

describe('remove_nodes', () => {
  it('removes nodes as one undo entry', async () => {
    const id = await addMath()
    useEditorStore.temporal.getState().clear()

    const result = await run('remove_nodes', { ids: [id] })

    expect(result.ok).toBe(true)
    expect(getState().graph.nodes[id]).toBeUndefined()
    expect(historyLength()).toBe(1)
  })

  it('on the master returns invalid', async () => {
    const before = getState().graph

    const result = await run('remove_nodes', { ids: [MASTER_NODE_ID] })

    expect(result).toMatchObject({ ok: false, error: { code: 'invalid' } })
    expect(getState().graph).toBe(before)
  })

  it('returns not_found with the current ids for an unknown node', async () => {
    const id = await addMath()
    const before = getState().graph

    const result = await run('remove_nodes', { ids: [id, 'ghost'] })

    expect(result).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(!result.ok && result.error.state).toEqual({ nodeIds: Object.keys(before.nodes) })
    expect(getState().graph).toBe(before)
  })
})

describe('move_nodes', () => {
  it('moves nodes and touches them', async () => {
    const id = await addMath()
    const harness = createHarness()

    const result = await run(
      'move_nodes',
      { positions: { [id]: { x: 40, y: 50 } } },
      harness.context,
    )

    expect(result.ok).toBe(true)
    expect(getState().graph.nodes[id]?.position).toEqual({ x: 40, y: 50 })
    expect(harness.touches).toEqual([{ nodeId: id, created: false }])
  })

  it('returns not_found and moves nothing when one id is unknown', async () => {
    const id = await addMath()
    const before = getState().graph

    const result = await run('move_nodes', {
      positions: { [id]: { x: 1, y: 1 }, ghost: { x: 2, y: 2 } },
    })

    expect(result).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(getState().graph).toBe(before)
  })
})

describe('connect and disconnect', () => {
  it('connects compatible ports and returns the edge id', async () => {
    const source = await addMath({ x: 0, y: 0 })
    const harness = createHarness()
    const result = await run(
      'connect',
      {
        from: { nodeId: source, portId: 'out' },
        to: { nodeId: MASTER_NODE_ID, portId: 'roughness' },
      },
      harness.context,
    )

    const edgeId = field(result, 'edgeId')
    expect(getState().graph.edges[asEdgeId(edgeId)]).toBeDefined()
    expect(harness.touches).toContainEqual({ nodeId: MASTER_NODE_ID, created: false })
  })

  it('with incompatible ports returns invalid with the rejection reason', async () => {
    const source = await addMath()
    const before = getState().graph

    const result = await run('connect', {
      from: { nodeId: source, portId: 'out' },
      to: { nodeId: source, portId: 'a' },
    })

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'invalid', state: { reason: 'same-node' } },
    })
    expect(getState().graph).toBe(before)
  })

  it('returns not_found for an unknown node or port', async () => {
    const source = await addMath()
    const before = getState().graph

    const unknownNode = await run('connect', {
      from: { nodeId: 'ghost', portId: 'out' },
      to: { nodeId: MASTER_NODE_ID, portId: 'roughness' },
    })
    const unknownPort = await run('connect', {
      from: { nodeId: source, portId: 'nope' },
      to: { nodeId: MASTER_NODE_ID, portId: 'roughness' },
    })

    expect(unknownNode).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(unknownPort).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(getState().graph).toBe(before)
  })

  it('moves the cursor to both ports, source first, with a pending wire', async () => {
    const source = await addMath()
    const arrive = vi.fn(() => Promise.resolve())
    const choreograph: Choreograph = { arrive, settle: vi.fn() }

    await run(
      'connect',
      {
        from: { nodeId: source, portId: 'out' },
        to: { nodeId: MASTER_NODE_ID, portId: 'roughness' },
      },
      createHarness({ choreograph }).context,
    )

    expect(arrive).toHaveBeenCalledTimes(2)
    expect(arrive.mock.calls[0]).toMatchObject([
      { kind: 'port', ref: { nodeId: source, portId: 'out' } },
      { pendingWire: { from: { nodeId: source, portId: 'out' } } },
    ])
    expect(arrive.mock.calls[1]).toMatchObject([
      { kind: 'port', ref: { nodeId: MASTER_NODE_ID, portId: 'roughness' } },
    ])
  })

  it('disconnects edges and returns not_found for unknown ones without changes', async () => {
    const source = await addMath()
    const connected = await run('connect', {
      from: { nodeId: source, portId: 'out' },
      to: { nodeId: MASTER_NODE_ID, portId: 'roughness' },
    })
    const edgeId = field(connected, 'edgeId')
    const before = getState().graph

    const missing = await run('disconnect', { edgeIds: [edgeId, 'ghost'] })
    expect(missing).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(getState().graph).toBe(before)

    const done = await run('disconnect', { edgeIds: [edgeId] })
    expect(done.ok).toBe(true)
    expect(Object.keys(getState().graph.edges)).toHaveLength(0)
  })
})

describe('set_input', () => {
  it('sets the value and returns the compile errors after the change', async () => {
    const id = await addMath()

    const result = await run('set_input', {
      nodeId: id,
      portId: 'a',
      value: { type: 'float', value: 3 },
    })

    expect(result.ok).toBe(true)
    expect(getState().graph.nodes[id]?.inputValues['a']).toEqual(float(3))
    if (!result.ok) return
    const expected = generateModule(getState().graph, registry).errors.map(
      ({ nodeId, message }) => ({ nodeId, message }),
    )
    expect(result.value).toMatchObject({ errors: expected })
  })

  it('returns not_found for an unknown node or port', async () => {
    const id = await addMath()
    const before = getState().graph

    const node = await run('set_input', {
      nodeId: 'ghost',
      portId: 'a',
      value: { type: 'float', value: 1 },
    })
    const port = await run('set_input', {
      nodeId: id,
      portId: 'nope',
      value: { type: 'float', value: 1 },
    })

    expect(node).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(port).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(getState().graph).toBe(before)
  })

  it('returns invalid when the value type does not fit the port', async () => {
    const id = await addMath()
    const before = getState().graph

    const result = await run('set_input', {
      nodeId: id,
      portId: 'a',
      value: { type: 'texture', assetId: null },
    })

    expect(result).toMatchObject({ ok: false, error: { code: 'invalid' } })
    expect(getState().graph).toBe(before)
  })
})

describe('set_param', () => {
  it('on a deleted node returns not_found with the current ids and changes nothing', async () => {
    const id = await addMath()
    await run('remove_nodes', { ids: [id] })
    const before = getState().graph

    const result = await run('set_param', { nodeId: id, paramId: 'x', value: 1 })

    expect(result).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(!result.ok && result.error.state).toEqual({ nodeIds: Object.keys(before.nodes) })
    expect(getState().graph).toBe(before)
  })

  it('returns invalid for an out-of-range value', async () => {
    const id = asNodeId(field(await run('add_node', { type: 'input/position' }), 'nodeId'))
    const paramId = registry.get('input/position')?.params?.find((p) => p.kind === 'enum')?.id
    if (paramId === undefined) throw new Error('input/position has no enum param')
    const before = getState().graph

    const result = await run('set_param', { nodeId: id, paramId, value: '__not_an_option__' })

    expect(result).toMatchObject({ ok: false, error: { code: 'invalid' } })
    expect(getState().graph).toBe(before)
  })
})

describe('properties', () => {
  it('add_property returns the id, set_property updates fields, remove_property removes it', async () => {
    const added = await run('add_property', { kind: 'float', name: 'speed' })
    const id = field(added, 'id')
    expect(getState().graph.properties.find((p) => p.id === id)?.name).toBe('speed')

    const updated = await run('set_property', {
      id,
      exposed: false,
      value: { type: 'float', value: 2 },
    })
    expect(updated.ok).toBe(true)
    expect(getState().graph.properties.find((p) => p.id === id)).toMatchObject({
      exposed: false,
      value: float(2),
    })

    const removed = await run('remove_property', { id })
    expect(removed.ok).toBe(true)
    expect(getState().graph.properties).toHaveLength(0)
  })

  it('set_property returns invalid for a bad name and changes nothing', async () => {
    const added = await run('add_property', { kind: 'float' })
    const id = field(added, 'id')
    const before = getState().graph

    const result = await run('set_property', { id, label: 'Other', name: '1 bad name!' })

    expect(result).toMatchObject({ ok: false, error: { code: 'invalid' } })
    expect(getState().graph).toBe(before)
  })

  it('add_property with a bad name returns invalid and changes nothing', async () => {
    const before = getState().graph

    const result = await run('add_property', { kind: 'float', name: '1 bad name!' })

    expect(result).toMatchObject({ ok: false, error: { code: 'invalid' } })
    expect(getState().graph).toBe(before)
  })

  it('returns not_found for an unknown property', async () => {
    const before = getState().graph

    expect(await run('set_property', { id: 'ghost', exposed: true })).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    })
    expect(await run('remove_property', { id: 'ghost' })).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    })
    expect(getState().graph).toBe(before)
  })
})

describe('tidy_up', () => {
  it('asks the canvas to tidy up', async () => {
    const harness = createHarness()

    const result = await run('tidy_up', {}, harness.context)

    expect(result.ok).toBe(true)
    expect(harness.calls).toEqual(['tidy'])
  })
})

describe('new_graph and load_template', () => {
  it('new_graph on a non-empty graph returns declined when confirm resolves false', async () => {
    await addMath()
    const before = getState().graph
    const confirm = vi.fn(() => Promise.resolve(false))

    const result = await run('new_graph', {}, createHarness({ confirm }).context)

    expect(confirm).toHaveBeenCalledWith('new_graph')
    expect(result).toMatchObject({ ok: false, error: { code: 'declined' } })
    expect(getState().graph).toBe(before)
  })

  it('new_graph on a graph with only the master resets without asking', async () => {
    const confirm = vi.fn(() => Promise.resolve(false))

    const result = await run('new_graph', {}, createHarness({ confirm }).context)

    expect(confirm).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })

  it('new_graph resets the graph once confirmed', async () => {
    const id = await addMath()

    const result = await run('new_graph', {})

    expect(result.ok).toBe(true)
    expect(getState().graph.nodes[id]).toBeUndefined()
  })

  it('load_template with an unknown id returns not_found', async () => {
    await addMath()
    const before = getState().graph
    const confirm = vi.fn(() => Promise.resolve(true))

    const result = await run(
      'load_template',
      { id: 'no-such-template' },
      createHarness({ confirm }).context,
    )

    expect(result).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(confirm).not.toHaveBeenCalled()
    expect(getState().graph).toBe(before)
  })

  it('load_template returns declined when the person says no', async () => {
    await addMath()
    const before = getState().graph

    const result = await run(
      'load_template',
      { id: 'lava-flow' },
      createHarness({ confirm: () => Promise.resolve(false) }).context,
    )

    expect(result).toMatchObject({ ok: false, error: { code: 'declined' } })
    expect(getState().graph).toBe(before)
  })
})

describe('a target deleted while the cursor travels', () => {
  async function runWithDeletion(tool: keyof typeof writeTools, args: unknown, targetId: NodeId) {
    let release: () => void = () => undefined
    const arrival = new Promise<void>((resolve) => (release = resolve))
    const choreograph: Choreograph = {
      arrive: () => arrival,
      settle: () => undefined,
    }
    const harness = createHarness({ choreograph })
    const pending = run(tool, args, harness.context)
    await Promise.resolve()
    getState().removeNodes([targetId])
    const graphAfterDeletion = getState().graph
    release()
    return { result: await pending, harness, graphAfterDeletion }
  }

  const cases: { tool: keyof typeof writeTools; args: (id: NodeId) => unknown }[] = [
    { tool: 'remove_nodes', args: (id) => ({ ids: [id] }) },
    { tool: 'move_nodes', args: (id) => ({ positions: { [id]: { x: 9, y: 9 } } }) },
    {
      tool: 'set_input',
      args: (id) => ({ nodeId: id, portId: 'a', value: { type: 'float', value: 1 } }),
    },
    { tool: 'set_param', args: (id) => ({ nodeId: id, paramId: 'x', value: 1 }) },
    {
      tool: 'connect',
      args: (id) => ({
        from: { nodeId: id, portId: 'out' },
        to: { nodeId: MASTER_NODE_ID, portId: 'roughness' },
      }),
    },
  ]

  it.each(cases)(
    '$tool returns not_found, does not touch and leaves the graph alone',
    async ({ tool, args }) => {
      const id =
        tool === 'set_param'
          ? asNodeId(field(await run('add_node', { type: 'input/position' }), 'nodeId'))
          : await addMath()
      const paramArgs =
        tool === 'set_param' ? { nodeId: id, paramId: 'space', value: 'world' } : args(id)

      const { result, harness, graphAfterDeletion } = await runWithDeletion(tool, paramArgs, id)

      expect(result).toMatchObject({ ok: false, error: { code: 'not_found' } })
      expect(harness.touches).toEqual([])
      expect(getState().graph).toBe(graphAfterDeletion)
    },
  )
})

describe('one undo entry per property write', () => {
  it('add_property with a name is one entry and shows the name as the label', async () => {
    const result = await run('add_property', { kind: 'float', name: 'speed' })
    const id = field(result, 'id')

    expect(historyLength()).toBe(1)
    expect(getState().graph.properties.find((p) => p.id === id)).toMatchObject({
      label: 'speed',
      name: 'speed',
      exposed: true,
    })
  })

  it('set_property with several fields is one entry', async () => {
    const id = field(await run('add_property', { kind: 'float' }), 'id')
    useEditorStore.temporal.getState().clear()

    const result = await run('set_property', {
      id,
      label: 'Wind Speed',
      name: 'windSpeed',
      exposed: false,
      value: { type: 'float', value: 4 },
    })

    expect(result.ok).toBe(true)
    expect(historyLength()).toBe(1)
    expect(getState().graph.properties.find((p) => p.id === id)).toMatchObject({
      label: 'Wind Speed',
      name: 'windSpeed',
      exposed: false,
      value: float(4),
    })
  })

  it('set_property with only a label lets the reference follow it, in one entry', async () => {
    const id = field(await run('add_property', { kind: 'float' }), 'id')
    useEditorStore.temporal.getState().clear()

    await run('set_property', { id, label: 'Wind Speed' })

    expect(historyLength()).toBe(1)
    expect(getState().graph.properties.find((p) => p.id === id)?.name).toBe('windSpeed')
  })
})
