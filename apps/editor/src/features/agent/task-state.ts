import type { AgentIdentity } from '@nudo-tsl/agent-protocol'
import type { NodeId } from '@nudo-tsl/core'
import type { AgentStep, AgentTask } from '@/store/store-types'

export interface TaskOpening {
  agent: AgentIdentity
  prompt: string | null
  plannedSteps: readonly string[]
  startedAt: number
}

export function openedTask({ agent, prompt, plannedSteps, startedAt }: TaskOpening): AgentTask {
  return {
    agent,
    prompt,
    implicit: prompt === null,
    startedAt,
    steps: plannedSteps.map((label) => ({ label, detail: null, state: 'pending' })),
    status: 'active',
    createdNodeIds: [],
    summary: null,
  }
}

const finishCurrent = (step: AgentStep): AgentStep =>
  step.state === 'current' ? { ...step, state: 'done' } : step

/** The task closed: the step in progress counts as done. */
export function completeTask(task: AgentTask, summary: string | null): AgentTask {
  return { ...task, status: 'finished', summary, steps: task.steps.map(finishCurrent) }
}

/**
 * Moves the task to the step labelled `label`: the current step is done, and a planned (pending)
 * step with that label is reused, otherwise a new step is appended.
 */
export function advanceStep(task: AgentTask, label: string, detail: string | null): AgentTask {
  const steps = task.steps.map(finishCurrent)
  const plannedIndex = steps.findIndex((step) => step.state === 'pending' && step.label === label)
  const current: AgentStep = { label, detail, state: 'current' }
  const nextSteps =
    plannedIndex === -1
      ? [...steps, current]
      : steps.map((step, index) => (index === plannedIndex ? current : step))
  return { ...task, steps: nextSteps }
}

export function withCreatedNode(task: AgentTask, nodeId: NodeId): AgentTask {
  if (task.createdNodeIds.includes(nodeId)) return task
  return { ...task, createdNodeIds: [...task.createdNodeIds, nodeId] }
}

/** Drops created nodes that are no longer in the graph; the same task when none left. */
export function withoutMissingNodes(
  task: AgentTask,
  isPresent: (id: NodeId) => boolean,
): AgentTask {
  const kept = task.createdNodeIds.filter(isPresent)
  return kept.length === task.createdNodeIds.length ? task : { ...task, createdNodeIds: kept }
}
