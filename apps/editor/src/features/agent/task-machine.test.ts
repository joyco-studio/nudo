import type { AgentIdentity, BridgeRequest, ToolName } from '@nudo-tsl/agent-protocol'
import { createGraph } from '@nudo-tsl/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '@/store/editor-store'
import { immediateChoreograph } from './choreography'
import { createRequestQueue } from './request-queue'
import {
  EXPLICIT_TASK_IDLE_MS,
  IMPLICIT_TASK_IDLE_MS,
  STOPPED_MESSAGE,
  createTaskMachine,
} from './task-machine'
import type { TaskMachine } from './task-machine'
import type { ToolContext } from './tool-context'
import { writeTools } from './write-tools'

const FIRST = { sessionId: 's1', name: 'Claude' }
const SECOND = { sessionId: 's2', name: 'Cursor' }
const task = () => useEditorStore.getState().agentTask

let machine: TaskMachine

function sharedContext(): Omit<ToolContext, 'agent'> {
  return {
    choreograph: immediateChoreograph,
    ...machine.contextHooks,
    tidyUp: () => Promise.resolve(),
    confirm: () => Promise.resolve(true),
  }
}

const contextFor = (agent: ToolContext['agent']): ToolContext => ({ agent, ...sharedContext() })

/** One whole tool call as the queue makes it: admitted, then settled at once. */
function call(tool: ToolName, agent: AgentIdentity) {
  const admitted = machine.gate.admit(tool, agent)
  if (admitted.ok) machine.gate.settle(agent)
  return admitted
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

const writeRequest = (tool: ToolName, args: unknown): BridgeRequest => ({
  kind: 'request',
  id: tool,
  tool,
  args,
  agent: FIRST,
})

/** A graph with a node in it, so replacing it asks the person first. */
function graphWithWork() {
  useEditorStore.getState().addNode('math/add', { x: 0, y: 0 })
  useEditorStore.temporal.getState().clear()
  return useEditorStore.getState().graph
}

beforeEach(() => {
  useEditorStore.setState({ graph: createGraph(), agentTask: null })
  useEditorStore.temporal.getState().clear()
  machine = createTaskMachine()
})

afterEach(() => {
  machine.dispose()
  vi.useRealTimers()
})

describe('task machine', () => {
  it('a write with no task opens an implicit task', () => {
    expect(machine.guardWrite(FIRST, 1_000)).toEqual({ ok: true, value: undefined })

    expect(task()).toMatchObject({
      agent: FIRST,
      prompt: null,
      implicit: true,
      startedAt: 1_000,
      status: 'active',
      steps: [],
      createdNodeIds: [],
    })
  })

  it('a write through the queue opens an implicit task and records the created node', async () => {
    const queue = createRequestQueue(writeTools, sharedContext(), machine.gate)
    const request: BridgeRequest = {
      kind: 'request',
      id: 'a',
      tool: 'add_node',
      args: { type: 'math/add', position: { x: 0, y: 0 } },
      agent: FIRST,
    }

    const response = await queue(request)

    expect(response.ok).toBe(true)
    expect(task()?.implicit).toBe(true)
    expect(task()?.createdNodeIds).toHaveLength(1)
    expect(machine.contextHooks.lastTouched()).toBe(task()?.createdNodeIds[0])
  })

  it('a write after Stop returns stopped_by_user', () => {
    machine.guardWrite(FIRST, 0)
    machine.stopAgent()

    expect(task()?.status).toBe('stopped')
    expect(machine.guardWrite(FIRST, 1)).toEqual({
      ok: false,
      error: { code: 'stopped_by_user', message: STOPPED_MESSAGE },
    })
    expect(STOPPED_MESSAGE).toBe('The person stopped you. Stop and ask them before continuing.')
  })

  it('start_task after Stop still returns stopped_by_user until resume', async () => {
    machine.guardWrite(FIRST, 0)
    machine.stopAgent()

    const blocked = await machine.taskTools.start_task(
      { prompt: 'Make it glow' },
      contextFor(FIRST),
    )
    expect(blocked).toMatchObject({ ok: false, error: { code: 'stopped_by_user' } })
    expect(task()?.status).toBe('stopped')

    machine.resumeAgent()
    expect(task()?.status).toBe('active')
    const started = await machine.taskTools.start_task(
      { prompt: 'Make it glow' },
      contextFor(FIRST),
    )
    expect(started.ok).toBe(true)
    expect(task()).toMatchObject({ prompt: 'Make it glow', implicit: false, status: 'active' })
  })

  it('a second agent gets busy while the first has an active task', async () => {
    machine.guardWrite(FIRST, 0)

    expect(machine.guardWrite(SECOND, 1)).toMatchObject({
      ok: false,
      error: { code: 'busy', state: { agent: 'Claude' } },
    })
    const started = await machine.taskTools.start_task({ prompt: 'mine' }, contextFor(SECOND))
    expect(started).toMatchObject({ ok: false, error: { code: 'busy' } })
    expect(task()?.agent).toEqual(FIRST)
    expect(call('get_graph', SECOND).ok).toBe(true)
  })

  it('the implicit task finishes after 60s idle', () => {
    vi.useFakeTimers()
    expect(call('add_node', FIRST).ok).toBe(true)

    vi.advanceTimersByTime(IMPLICIT_TASK_IDLE_MS / 2)
    call('get_graph', FIRST)
    vi.advanceTimersByTime(IMPLICIT_TASK_IDLE_MS - 1)
    expect(task()?.status).toBe('active')

    vi.advanceTimersByTime(1)
    expect(task()?.status).toBe('finished')
    expect(IMPLICIT_TASK_IDLE_MS).toBe(60_000)
  })

  it('an explicit task stays open for 10 minutes without activity', async () => {
    vi.useFakeTimers()
    await machine.taskTools.start_task({ prompt: 'Make it glow' }, contextFor(FIRST))
    machine.gate.settle(FIRST)

    vi.advanceTimersByTime(IMPLICIT_TASK_IDLE_MS)
    expect(task()?.status).toBe('active')
    vi.advanceTimersByTime(EXPLICIT_TASK_IDLE_MS - IMPLICIT_TASK_IDLE_MS - 1)
    expect(task()?.status).toBe('active')

    vi.advanceTimersByTime(1)
    expect(task()?.status).toBe('finished')
    expect(EXPLICIT_TASK_IDLE_MS).toBe(600_000)
  })

  it('an explicit task resumed after Stop keeps the 10 minute idle time', async () => {
    vi.useFakeTimers()
    await machine.taskTools.start_task({ prompt: 'Make it glow' }, contextFor(FIRST))
    machine.stopAgent()
    machine.resumeAgent()

    vi.advanceTimersByTime(EXPLICIT_TASK_IDLE_MS - 1)
    expect(task()?.status).toBe('active')
    vi.advanceTimersByTime(1)
    expect(task()?.status).toBe('finished')
  })

  it('set_step marks the previous step done', async () => {
    const context = contextFor(FIRST)
    await machine.taskTools.start_task({ prompt: 'p', steps: ['Add noise', 'Wire it'] }, context)

    await machine.taskTools.set_step({ label: 'Add noise' }, context)
    expect(task()?.steps).toEqual([
      { label: 'Add noise', detail: null, state: 'current' },
      { label: 'Wire it', detail: null, state: 'pending' },
    ])

    await machine.taskTools.set_step({ label: 'Wire it', detail: 'step 2 of 2' }, context)
    expect(task()?.steps).toEqual([
      { label: 'Add noise', detail: null, state: 'done' },
      { label: 'Wire it', detail: 'step 2 of 2', state: 'current' },
    ])

    await machine.taskTools.set_step({ label: 'Polish' }, context)
    expect(task()?.steps.map((step) => step.state)).toEqual(['done', 'done', 'current'])
  })

  it('finish_task closes the task with its summary', async () => {
    const context = contextFor(FIRST)
    await machine.taskTools.start_task({ prompt: 'p', steps: ['a'] }, context)
    await machine.taskTools.set_step({ label: 'a' }, context)

    const finished = await machine.taskTools.finish_task({ summary: 'All set' }, context)

    expect(finished.ok).toBe(true)
    expect(task()).toMatchObject({ status: 'finished', summary: 'All set' })
    expect(task()?.steps[0]?.state).toBe('done')
    expect(machine.guardWrite(SECOND, 5).ok).toBe(true)
    expect(task()?.agent).toEqual(SECOND)
  })

  it('drops created nodes that leave the graph and forgets them as last touched', () => {
    machine.guardWrite(FIRST, 0)
    const nodeId = useEditorStore.getState().addNode('math/add', { x: 0, y: 0 })
    if (nodeId === null) throw new Error('node not added')
    machine.contextHooks.onTouch({ nodeId, created: true })
    expect(task()?.createdNodeIds).toEqual([nodeId])

    useEditorStore.getState().removeNodes([nodeId])

    expect(task()?.createdNodeIds).toEqual([])
    expect(machine.contextHooks.lastTouched()).toBeNull()
  })
})

describe('task machine around in-flight writes', () => {
  it('Stop pressed while the cursor travels refuses the write and leaves the graph alone', async () => {
    const arrived = deferred<undefined>()
    const travel = deferred<undefined>()
    const queue = createRequestQueue(
      writeTools,
      {
        ...sharedContext(),
        choreograph: {
          arrive: () => {
            arrived.resolve(undefined)
            return travel.promise
          },
          settle: () => undefined,
        },
      },
      machine.gate,
    )
    const before = useEditorStore.getState().graph

    const pending = queue(writeRequest('add_node', { type: 'math/add', position: { x: 0, y: 0 } }))
    await arrived.promise
    machine.stopAgent()
    travel.resolve(undefined)

    expect(await pending).toMatchObject({ ok: false, error: { code: 'stopped_by_user' } })
    expect(useEditorStore.getState().graph).toBe(before)
  })

  it('Stop pressed while new_graph waits for confirmation refuses the reset', async () => {
    const before = graphWithWork()
    const asked = deferred<undefined>()
    const answer = deferred<boolean>()
    const queue = createRequestQueue(
      writeTools,
      {
        ...sharedContext(),
        confirm: () => {
          asked.resolve(undefined)
          return answer.promise
        },
      },
      machine.gate,
    )

    const pending = queue(writeRequest('new_graph', {}))
    await asked.promise
    machine.stopAgent()
    answer.resolve(true)

    expect(await pending).toMatchObject({ ok: false, error: { code: 'stopped_by_user' } })
    expect(useEditorStore.getState().graph).toBe(before)
  })

  it('finishTask leaves a stopped task stopped, so writes stay refused', () => {
    machine.guardWrite(FIRST, 0)
    machine.stopAgent()

    machine.finishTask('done')

    expect(task()?.status).toBe('stopped')
    expect(machine.guardWrite(FIRST, 1)).toMatchObject({
      ok: false,
      error: { code: 'stopped_by_user' },
    })
  })

  it('the task does not go idle while its agent waits on a long handler', async () => {
    vi.useFakeTimers()
    graphWithWork()
    const asked = deferred<undefined>()
    const answer = deferred<boolean>()
    const queue = createRequestQueue(
      writeTools,
      {
        ...sharedContext(),
        confirm: () => {
          asked.resolve(undefined)
          return answer.promise
        },
      },
      machine.gate,
    )

    const pending = queue(writeRequest('new_graph', {}))
    await asked.promise
    vi.advanceTimersByTime(IMPLICIT_TASK_IDLE_MS * 2)
    expect(task()?.status).toBe('active')

    answer.resolve(true)
    expect(await pending).toMatchObject({ ok: true })
    vi.advanceTimersByTime(IMPLICIT_TASK_IDLE_MS - 1)
    expect(task()?.status).toBe('active')
    vi.advanceTimersByTime(1)
    expect(task()?.status).toBe('finished')
  })
})
