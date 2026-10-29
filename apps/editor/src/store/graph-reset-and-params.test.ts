import { MASTER_NODE_ID, createGraph, err, ok, setParam } from '@nudo-tsl/core'
import type { NodeId } from '@nudo-tsl/core'
import { beforeEach, describe, expect, it } from 'vitest'

import { undo, useEditorStore } from './editor-store'

const getState = () => useEditorStore.getState()
const historyLength = () => useEditorStore.temporal.getState().pastStates.length
const ORIGIN = { x: 0, y: 0 }

function addNodeOrFail(type: string): NodeId {
  const id = getState().addNode(type, ORIGIN)
  if (id === null) throw new Error(`Could not add node of type ${type}`)
  return id
}

beforeEach(() => {
  useEditorStore.setState({
    graph: createGraph(),
    selectedNodeIds: [],
    draftPositions: {},
    inputPreview: null,
    notice: null,
    errorsByNode: {},
  })
  useEditorStore.temporal.getState().clear()
})

describe('setParam', () => {
  it('stores the value as one undoable history entry', () => {
    const ref = { nodeId: MASTER_NODE_ID, paramId: 'lighting' }
    const graphBefore = getState().graph

    getState().setParam(ref, 'unlit')

    expect(getState().graph.nodes[MASTER_NODE_ID]?.params.lighting).toBe('unlit')
    expect(historyLength()).toBe(1)
    undo()
    expect(getState().graph).toBe(graphBefore)
  })

  it('sets universal params such as collapsed', () => {
    const id = addNodeOrFail('math/sin')
    getState().setParam({ nodeId: id, paramId: 'collapsed' }, true)
    expect(getState().graph.nodes[id]?.params.collapsed).toBe(true)
  })

  it('creates no history entry when the effective value does not change', () => {
    const graphBefore = getState().graph
    // Lighting is absent, which means its default.
    getState().setParam({ nodeId: MASTER_NODE_ID, paramId: 'lighting' }, 'standard')
    expect(getState().graph).toBe(graphBefore)
    expect(historyLength()).toBe(0)
  })

  it('ignores invalid values and unknown params', () => {
    const graphBefore = getState().graph
    getState().setParam({ nodeId: MASTER_NODE_ID, paramId: 'lighting' }, 'neon')
    getState().setParam({ nodeId: MASTER_NODE_ID, paramId: 'ghost' }, true)
    expect(getState().graph).toBe(graphBefore)
  })
})

describe('commitResize', () => {
  it('commits position and size as a single history entry and clears the drafts', () => {
    const id = addNodeOrFail('utility/comment')
    const entriesBefore = historyLength()
    getState().setDraftPositions({ [id]: { x: -20, y: -10 } })

    getState().commitResize(id, { position: { x: -20, y: -10 }, width: 400, height: 240 })

    const node = getState().graph.nodes[id]
    expect(node?.position).toEqual({ x: -20, y: -10 })
    expect(node?.params).toMatchObject({ width: 400, height: 240 })
    expect(getState().draftPositions).toEqual({})
    expect(historyLength()).toBe(entriesBefore + 1)
  })

  it('creates no entry when nothing changed', () => {
    const id = addNodeOrFail('utility/comment')
    getState().commitResize(id, { position: ORIGIN, width: 320, height: 200 })
    const graphBefore = getState().graph
    const entriesBefore = historyLength()

    getState().commitResize(id, { position: ORIGIN, width: 320, height: 200 })

    expect(getState().graph).toBe(graphBefore)
    expect(historyLength()).toBe(entriesBefore)
  })
})

describe('resetGraph', () => {
  it('replaces the graph with a fresh one in one entry, and undo restores it', () => {
    const id = addNodeOrFail('math/sin')
    getState().setSelection([id])
    const graphBefore = getState().graph
    const entriesBefore = historyLength()

    getState().resetGraph()

    expect(Object.keys(getState().graph.nodes)).toEqual([MASTER_NODE_ID])
    expect(getState().graph.properties).toEqual([])
    expect(getState().selectedNodeIds).toEqual([])
    expect(historyLength()).toBe(entriesBefore + 1)

    undo()
    expect(getState().graph).toBe(graphBefore)
  })
})

describe('replaceGraph', () => {
  it('loads another graph in one entry, clears the selection, and undo restores the old one', () => {
    const id = addNodeOrFail('math/sin')
    getState().setSelection([id])
    const graphBefore = getState().graph
    const entriesBefore = historyLength()
    const replacement = createGraph()

    getState().replaceGraph(replacement)

    expect(getState().graph).toBe(replacement)
    expect(getState().selectedNodeIds).toEqual([])
    expect(historyLength()).toBe(entriesBefore + 1)

    undo()
    expect(getState().graph).toBe(graphBefore)
  })
})

describe('applyGraphChange', () => {
  it('commits the change as one entry, keeps the selection, and one undo reverts it', () => {
    const id = addNodeOrFail('color/color-ramp')
    getState().setSelection([id])
    const graphBefore = getState().graph
    const entriesBefore = historyLength()

    const error = getState().applyGraphChange((graph, registry) => {
      const counted = setParam(graph, registry, { nodeId: id, paramId: 'count' }, 3)
      return counted.ok ? ok(counted.value) : err('rejected')
    })

    expect(error).toBeNull()
    expect(getState().graph.nodes[id]?.params.count).toBe(3)
    expect(getState().selectedNodeIds).toEqual([id])
    expect(historyLength()).toBe(entriesBefore + 1)
    undo()
    expect(getState().graph).toBe(graphBefore)
  })

  it('leaves the graph and the history alone when the change is refused', () => {
    const graphBefore = getState().graph
    const error = getState().applyGraphChange(() => err('too-few-stops'))

    expect(error).toBe('too-few-stops')
    expect(getState().graph).toBe(graphBefore)
    expect(historyLength()).toBe(0)
  })
})

describe('previewShape', () => {
  it('starts on the sphere and changes without a history entry', () => {
    const entriesBefore = historyLength()
    expect(getState().previewShape).toBe('sphere')

    getState().setPreviewShape('plane')

    expect(getState().previewShape).toBe('plane')
    expect(historyLength()).toBe(entriesBefore)
    getState().setPreviewShape('sphere')
  })
})
