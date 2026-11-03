import type { AgentError, AgentIdentity, ToolName } from '@nudo-tsl/agent-protocol'
import { err, ok } from '@nudo-tsl/core'
import type { NodeId, Result } from '@nudo-tsl/core'
import { useEditorStore } from '@/store/editor-store'
import type { AgentTask } from '@/store/store-types'
import { defineHandler } from './define-handler'
import {
  advanceStep,
  completeTask,
  openedTask,
  withCreatedNode,
  withoutMissingNodes,
} from './task-state'
import type { TaskOpening } from './task-state'
import { isWriteTool } from './tool-kinds'
import type { TaskToolName } from './tool-kinds'
import type { ToolContext, ToolHandler } from './tool-context'
import { beginSnapshot } from './undo-all'

/** A task with no tool call from its agent for this long finishes by itself. */
export const IMPLICIT_TASK_IDLE_MS = 60_000

export const STOPPED_MESSAGE = 'The person stopped you. Stop and ask them before continuing.'

type TimerHandle = ReturnType<typeof setTimeout>

export interface TaskClock {
  now: () => number
  setTimer: (run: () => void, delayMs: number) => TimerHandle
  clearTimer: (handle: TimerHandle) => void
}

/** Reads the globals on every call, so fake timers installed after import still apply. */
const systemClock: TaskClock = {
  now: () => Date.now(),
  setTimer: (run, delayMs) => setTimeout(run, delayMs),
  clearTimer: (handle) => {
    clearTimeout(handle)
  },
}

export type ToolGate = (tool: ToolName, agent: AgentIdentity) => Result<void, AgentError>

export type TaskContextHooks = Pick<ToolContext, 'onTouch' | 'lastTouched'>

export interface TaskMachine {
  /** Runs before every write tool: Stop and busy refuse it, and no active task opens an implicit one. */
  guardWrite: (agent: AgentIdentity, now: number) => Result<void, AgentError>
  /** Runs before every tool call: guards writes and keeps the owner's task from going idle. */
  gate: ToolGate
  stopAgent: () => void
  resumeAgent: () => void
  finishTask: (summary?: string) => void
  taskTools: Pick<Record<ToolName, ToolHandler>, TaskToolName>
  contextHooks: TaskContextHooks
  dispose: () => void
}

const getStore = () => useEditorStore.getState()
const currentTask = (): AgentTask | null => getStore().agentTask

const stoppedByUser = (): Result<never, AgentError> =>
  err({ code: 'stopped_by_user', message: STOPPED_MESSAGE })

const busyWith = (owner: AgentIdentity): Result<never, AgentError> =>
  err({
    code: 'busy',
    message: `${owner.name} is working on the graph right now. Try again when it is done.`,
    state: { agent: owner.name },
  })

const noTask = (): Result<never, AgentError> =>
  err({ code: 'invalid', message: 'No task is open. Call start_task first.' })

const isOwner = (task: AgentTask, agent: AgentIdentity): boolean =>
  task.agent.sessionId === agent.sessionId

/** Stop beats everything; an active task of another agent makes this one busy. */
function refusal(agent: AgentIdentity): Result<never, AgentError> | null {
  const task = currentTask()
  if (task?.status === 'stopped') return stoppedByUser()
  if (task?.status === 'active' && !isOwner(task, agent)) return busyWith(task.agent)
  return null
}

export function createTaskMachine(clock: TaskClock = systemClock): TaskMachine {
  let idleTimer: TimerHandle | null = null
  let lastTouchedId: NodeId | null = null

  const cancelIdle = (): void => {
    if (idleTimer === null) return
    clock.clearTimer(idleTimer)
    idleTimer = null
  }

  const finishTask = (summary?: string): void => {
    cancelIdle()
    const task = currentTask()
    if (task === null || task.status === 'finished') return
    getStore().setAgentTask(completeTask(task, summary ?? null))
  }

  const finishIfIdle = (): void => {
    idleTimer = null
    if (currentTask()?.status === 'active') finishTask()
  }

  const restartIdle = (): void => {
    cancelIdle()
    idleTimer = clock.setTimer(finishIfIdle, IMPLICIT_TASK_IDLE_MS)
  }

  const openTask = (opening: TaskOpening): void => {
    beginSnapshot()
    lastTouchedId = null
    getStore().setAgentTask(openedTask(opening))
    restartIdle()
  }

  /** Any tool call by the active task's agent counts as activity. */
  const noteActivity = (agent: AgentIdentity): void => {
    const task = currentTask()
    if (task?.status === 'active' && isOwner(task, agent)) restartIdle()
  }

  const guardWrite: TaskMachine['guardWrite'] = (agent, now) => {
    const refused = refusal(agent)
    if (refused !== null) return refused
    if (currentTask()?.status !== 'active') {
      openTask({ agent, prompt: null, plannedSteps: [], startedAt: now })
    }
    return ok(undefined)
  }

  const gate: ToolGate = (tool, agent) => {
    if (isWriteTool(tool)) {
      const guarded = guardWrite(agent, clock.now())
      if (!guarded.ok) return guarded
    }
    noteActivity(agent)
    return ok(undefined)
  }

  const stopAgent = (): void => {
    const task = currentTask()
    if (task?.status !== 'active') return
    cancelIdle()
    getStore().setAgentTask({ ...task, status: 'stopped' })
  }

  const resumeAgent = (): void => {
    const task = currentTask()
    if (task?.status !== 'stopped') return
    getStore().setAgentTask({ ...task, status: 'active' })
    restartIdle()
  }

  /** The active task, when `agent` may change it; otherwise why not. */
  const ownedTask = (agent: AgentIdentity): Result<AgentTask, AgentError> => {
    const refused = refusal(agent)
    if (refused !== null) return refused
    const task = currentTask()
    return task?.status === 'active' ? ok(task) : noTask()
  }

  const taskTools: TaskMachine['taskTools'] = {
    start_task: defineHandler('start_task', ({ prompt, steps }, context) => {
      const refused = refusal(context.agent)
      if (refused !== null) return Promise.resolve(refused)
      openTask({
        agent: context.agent,
        prompt,
        plannedSteps: steps ?? [],
        startedAt: clock.now(),
      })
      return Promise.resolve(ok({}))
    }),
    set_step: defineHandler('set_step', ({ label, detail }, context) => {
      const task = ownedTask(context.agent)
      if (!task.ok) return Promise.resolve(task)
      getStore().setAgentTask(advanceStep(task.value, label, detail ?? null))
      return Promise.resolve(ok({}))
    }),
    finish_task: defineHandler('finish_task', ({ summary }, context) => {
      if (currentTask()?.status !== 'active' && currentTask()?.status !== 'stopped') {
        // Nothing open (it may have gone idle): finishing again is harmless.
        return Promise.resolve(ok({}))
      }
      const task = ownedTask(context.agent)
      if (!task.ok) return Promise.resolve(task)
      finishTask(summary)
      return Promise.resolve(ok({}))
    }),
  }

  const contextHooks: TaskContextHooks = {
    onTouch: ({ nodeId, created }) => {
      lastTouchedId = nodeId
      const task = currentTask()
      if (!created || task?.status !== 'active') return
      getStore().setAgentTask(withCreatedNode(task, nodeId))
    },
    lastTouched: () => {
      if (lastTouchedId === null) return null
      return getStore().graph.nodes[lastTouchedId] === undefined ? null : lastTouchedId
    },
  }

  /** Nodes can leave the graph by a user delete, an agent remove or an undo. */
  const unsubscribe = useEditorStore.subscribe((state, previous) => {
    if (state.graph === previous.graph) return
    const isPresent = (id: NodeId): boolean => state.graph.nodes[id] !== undefined
    if (lastTouchedId !== null && !isPresent(lastTouchedId)) lastTouchedId = null
    const task = state.agentTask
    if (task === null) return
    const pruned = withoutMissingNodes(task, isPresent)
    if (pruned !== task) getStore().setAgentTask(pruned)
  })

  const dispose = (): void => {
    cancelIdle()
    unsubscribe()
  }

  return {
    guardWrite,
    gate,
    stopAgent,
    resumeAgent,
    finishTask,
    taskTools,
    contextHooks,
    dispose,
  }
}

/** The editor's one task machine; the bridge mount and the activity panel share it. */
export const taskMachine = createTaskMachine()

export const {
  guardWrite,
  gate: gateToolCall,
  stopAgent,
  resumeAgent,
  finishTask,
  taskTools,
  contextHooks: taskContextHooks,
} = taskMachine
