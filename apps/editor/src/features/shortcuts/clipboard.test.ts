import { MASTER_NODE_ID, createGraph, parseFragment } from '@nudo-tsl/core'
import type { NodeId } from '@nudo-tsl/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useEditorStore } from '@/store/editor-store'
import { registry } from '@/store/registry'

import { copySelection, pasteFromClipboard } from './clipboard'

const FLOAT_NODE = 'input/float'
const SINE_NODE = 'math/sin'
const NOT_NUDO_NOTICE = "Clipboard doesn't contain nudo-tsl nodes"

const getState = () => useEditorStore.getState()
const historyLength = () => useEditorStore.temporal.getState().pastStates.length

const writeText = vi.fn<(text: string) => Promise<void>>()
const readText = vi.fn<() => Promise<string>>()

function addNodeOrFail(type: string, position = { x: 0, y: 0 }): NodeId {
  const id = getState().addNode(type, position)
  if (id === null) throw new Error(`Could not add node of type ${type}`)
  return id
}

/** A float node feeding a sine node, both selected. */
function selectConnectedPair(): { source: NodeId; target: NodeId } {
  const source = addNodeOrFail(FLOAT_NODE, { x: 10, y: 20 })
  const target = addNodeOrFail(SINE_NODE, { x: 200, y: 20 })
  getState().connect({ nodeId: source, portId: 'out' }, { nodeId: target, portId: 'in' })
  getState().setSelection([source, target])
  return { source, target }
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
  writeText.mockReset().mockResolvedValue(undefined)
  readText.mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText, readText },
    configurable: true,
  })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('copySelection', () => {
  it('writes the selected nodes and the edges between them as a fragment', async () => {
    const { source, target } = selectConnectedPair()

    await copySelection()

    expect(writeText).toHaveBeenCalledTimes(1)
    const parsed = parseFragment(writeText.mock.calls[0]?.[0] ?? '', registry)
    if (!parsed.ok) throw new Error('Expected a valid fragment')
    expect(parsed.value.nodes.map((node) => node.id).sort()).toEqual([source, target].sort())
    expect(parsed.value.edges).toHaveLength(1)
  })

  it('copies the given nodes instead of the selection when asked', async () => {
    const { source } = selectConnectedPair()

    await copySelection([source])

    const parsed = parseFragment(writeText.mock.calls[0]?.[0] ?? '', registry)
    if (!parsed.ok) throw new Error('Expected a valid fragment')
    expect(parsed.value.nodes.map((node) => node.id)).toEqual([source])
    expect(parsed.value.edges).toEqual([])
  })

  it('writes nothing when nothing copyable is selected', async () => {
    getState().setSelection([])
    await copySelection()
    getState().setSelection([MASTER_NODE_ID])
    await copySelection()

    expect(writeText).not.toHaveBeenCalled()
  })

  it('tells the person when the clipboard refuses the write', async () => {
    selectConnectedPair()
    writeText.mockRejectedValue(new Error('denied'))

    await copySelection()

    expect(getState().notice).toEqual({ kind: 'error', message: "Couldn't copy to the clipboard" })
  })
})

describe('pasteFromClipboard', () => {
  it('pastes a copied fragment 40 px away, with its edge, and selects the new nodes', async () => {
    const { source, target } = selectConnectedPair()
    await copySelection()
    readText.mockResolvedValue(writeText.mock.calls[0]?.[0] ?? '')
    const entriesBefore = historyLength()

    await pasteFromClipboard()

    const graph = getState().graph
    expect(Object.keys(graph.nodes)).toHaveLength(5)
    expect(Object.keys(graph.edges)).toHaveLength(2)
    expect(historyLength()).toBe(entriesBefore + 1)
    const pasted = getState().selectedNodeIds
    expect(pasted).toHaveLength(2)
    expect(pasted).not.toContain(source)
    expect(pasted).not.toContain(target)
    const positions = pasted.map((id) => graph.nodes[id]?.position)
    expect(positions).toContainEqual({ x: 50, y: 60 })
    expect(positions).toContainEqual({ x: 240, y: 60 })
  })

  it('places the pasted nodes with their top-left corner at a given flow point', async () => {
    selectConnectedPair()
    await copySelection()
    readText.mockResolvedValue(writeText.mock.calls[0]?.[0] ?? '')

    await pasteFromClipboard({ x: 500, y: 300 })

    const graph = getState().graph
    const positions = getState().selectedNodeIds.map((id) => graph.nodes[id]?.position)
    expect(positions).toContainEqual({ x: 500, y: 300 })
    expect(positions).toContainEqual({ x: 690, y: 300 })
  })

  it('shows a notice and changes nothing when the clipboard holds prose', async () => {
    selectConnectedPair()
    const graphBefore = getState().graph
    const entriesBefore = historyLength()
    readText.mockResolvedValue('just some prose, not JSON')

    await pasteFromClipboard()

    expect(getState().notice).toEqual({ kind: 'info', message: NOT_NUDO_NOTICE })
    expect(getState().graph).toBe(graphBefore)
    expect(historyLength()).toBe(entriesBefore)
  })

  it('treats JSON that is not a fragment the same way', async () => {
    const graphBefore = getState().graph
    readText.mockResolvedValue(JSON.stringify({ kind: 'something-else', nodes: [] }))

    await pasteFromClipboard()

    expect(getState().notice?.message).toBe(NOT_NUDO_NOTICE)
    expect(getState().graph).toBe(graphBefore)
  })

  it('tells the person when the clipboard cannot be read', async () => {
    const graphBefore = getState().graph
    readText.mockRejectedValue(new Error('denied'))

    await pasteFromClipboard()

    expect(getState().notice).toEqual({ kind: 'error', message: "Couldn't read the clipboard" })
    expect(getState().graph).toBe(graphBefore)
  })
})
