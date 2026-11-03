import { createGraph } from '@nudo-tsl/core'
import type { Graph } from '@nudo-tsl/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { undo, useEditorStore } from '@/store/editor-store'
import { beginSnapshot, discardSnapshot, markAgentWrite, undoAll } from './undo-all'

const getState = () => useEditorStore.getState()
const graph = (): Graph => getState().graph
const historyLength = () => useEditorStore.temporal.getState().pastStates.length

const agentAdds = (x: number) => markAgentWrite(() => getState().addNode('math/add', { x, y: 0 }))

beforeEach(() => {
  useEditorStore.setState({
    graph: createGraph(),
    agentTask: {
      agent: { sessionId: 's1', name: 'Claude' },
      prompt: 'p',
      implicit: false,
      startedAt: 0,
      steps: [],
      status: 'active',
      createdNodeIds: [],
      summary: null,
    },
  })
  useEditorStore.temporal.getState().clear()
  discardSnapshot()
})

describe('undo all', () => {
  it('undoAll restores the snapshot as one undo entry', async () => {
    beginSnapshot()
    const start = graph()
    agentAdds(0)
    agentAdds(200)
    const agentGraph = graph()
    const before = historyLength()

    expect(await undoAll(() => Promise.resolve(true))).toBe(true)

    expect(graph()).toBe(start)
    expect(historyLength()).toBe(before + 1)
    expect(getState().agentTask?.status).toBe('finished')
    undo()
    expect(graph()).toBe(agentGraph)
  })

  it('undoAll asks for confirmation only after a user edit', async () => {
    beginSnapshot()
    agentAdds(0)
    const confirm = vi.fn(() => Promise.resolve(false))

    expect(await undoAll(confirm)).toBe(true)
    expect(confirm).not.toHaveBeenCalled()

    beginSnapshot()
    agentAdds(0)
    getState().addNode('math/add', { x: 400, y: 0 })
    const edited = graph()

    expect(await undoAll(confirm)).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(graph()).toBe(edited)
  })

  it('user undo of an agent change mid-task does not count as a user edit, and undoAll still restores the start snapshot', async () => {
    beginSnapshot()
    const start = graph()
    agentAdds(0)
    agentAdds(200)
    undo()
    const third = agentAdds(400)
    expect(third).not.toBeNull()
    expect(Object.keys(graph().nodes)).toHaveLength(Object.keys(start.nodes).length + 2)

    const confirm = vi.fn(() => Promise.resolve(true))
    expect(await undoAll(confirm)).toBe(true)

    expect(confirm).not.toHaveBeenCalled()
    expect(graph()).toBe(start)
  })

  it('undoAll does nothing without a snapshot', async () => {
    const before = graph()
    expect(await undoAll(() => Promise.resolve(true))).toBe(false)
    expect(graph()).toBe(before)
  })
})
