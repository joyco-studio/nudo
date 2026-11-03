import { asNodeId } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import type { AgentPresence, AgentTask } from '@/store/store-types'

import { creatorNameOf, currentStepOf, cursorTransitionFor, editorNameOf } from './presence-model'

const CREATED = asNodeId('created')
const OTHER = asNodeId('other')

const task: AgentTask = {
  agent: { sessionId: 's1', name: 'Claude' },
  prompt: null,
  implicit: true,
  startedAt: 0,
  steps: [
    { label: 'Read the graph', detail: null, state: 'done' },
    { label: 'Add noise', detail: null, state: 'current' },
  ],
  status: 'active',
  createdNodeIds: [CREATED],
  summary: null,
}

const onPort: AgentPresence = {
  target: { kind: 'port', ref: { nodeId: OTHER, portId: 'a' } },
  ghost: null,
  pendingWire: null,
}

describe('presence model', () => {
  it('credits only the nodes the current task created', () => {
    expect(creatorNameOf({ agentTask: task, agentPresence: null }, CREATED)).toBe('Claude')
    expect(creatorNameOf({ agentTask: task, agentPresence: null }, OTHER)).toBeNull()
    expect(creatorNameOf({ agentTask: null, agentPresence: null }, CREATED)).toBeNull()
  })

  it('tags the node the cursor is on, through the node or one of its ports', () => {
    const state = { agentTask: task, agentPresence: onPort }
    expect(editorNameOf(state, OTHER)).toBe('Claude')
    expect(editorNameOf(state, CREATED)).toBeNull()
    expect(editorNameOf({ agentTask: null, agentPresence: onPort }, OTHER)).toBeNull()
  })

  it('announces the step in progress', () => {
    expect(currentStepOf(task)).toEqual({ name: 'Claude', step: 'Add noise' })
    expect(currentStepOf({ ...task, steps: [] })).toBeNull()
    expect(currentStepOf(null)).toBeNull()
  })

  it('jumps the cursor with reduced motion', () => {
    expect(cursorTransitionFor(true).duration).toBe(0)
    expect(cursorTransitionFor(false).duration).toBeGreaterThan(0)
  })
})
