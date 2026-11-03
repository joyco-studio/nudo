import type { NodeId } from '@nudo-tsl/core'

import { DURATION_MS, EASE, toSeconds } from '@/shared/motion/tokens'
import type { AgentPresence, AgentTask } from '@/store/store-types'

interface AgentView {
  readonly agentTask: AgentTask | null
  readonly agentPresence: AgentPresence | null
}

/** The agent that created this node in the current task, to credit it on the node; else null. */
export function creatorNameOf(state: AgentView, nodeId: NodeId): string | null {
  const task = state.agentTask
  if (task === null || !task.createdNodeIds.includes(nodeId)) return null
  return task.agent.name
}

/** The node the agent's cursor is on: the node itself or one of its ports. */
export function targetNodeId(target: AgentPresence['target']): NodeId | null {
  switch (target.kind) {
    case 'node':
      return target.nodeId
    case 'port':
      return target.ref.nodeId
    case 'point':
      return null
  }
}

/** The agent editing this node right now (its cursor is on it), to tag the node; else null. */
export function editorNameOf(state: AgentView, nodeId: NodeId): string | null {
  const { agentTask, agentPresence } = state
  if (agentTask === null || agentPresence === null) return null
  return targetNodeId(agentPresence.target) === nodeId ? agentTask.agent.name : null
}

export interface StepAnnouncement {
  readonly name: string
  readonly step: string
}

/** The step the agent is on, for the live region; null when no step is in progress. */
export function currentStepOf(task: AgentTask | null): StepAnnouncement | null {
  const current = task?.steps.find((step) => step.state === 'current')
  if (task === null || current === undefined) return null
  return { name: task.agent.name, step: current.label }
}

export interface CursorTransition {
  readonly duration: number
  readonly ease: readonly [number, number, number, number]
}

/**
 * How the cursor travels to its next target: over the choreography's travel time (`DURATION_MS.slow`,
 * the same wait the tools await), or a jump with reduced motion. The keyboard modality does not
 * apply: the agent moves the cursor, not the person.
 */
export function cursorTransitionFor(prefersReducedMotion: boolean): CursorTransition {
  const duration = prefersReducedMotion ? 0 : toSeconds(DURATION_MS.slow)
  return { duration, ease: EASE.smoothOut }
}
