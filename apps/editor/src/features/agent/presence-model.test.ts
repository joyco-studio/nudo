import { asNodeId } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import type { AgentPresence, AgentTask } from '@/store/store-types'

import {
  creatorNameOf,
  currentStepOf,
  cursorTransitionFor,
  editorNameOf,
  nextCursorMove,
  restingCursorMove,
} from './presence-model'

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
    expect(cursorTransitionFor(true, true).duration).toBe(0)
    expect(cursorTransitionFor(false, true).duration).toBeGreaterThan(0)
  })

  it('travels only to a new target: a zoom or a dragged target node moves the cursor at once', () => {
    const nodeTarget = { kind: 'node', nodeId: OTHER } as const
    const resting = restingCursorMove(nodeTarget, { x: 100, y: 50 })
    expect(cursorTransitionFor(false, resting.travels).duration).toBe(0)

    const zoomed = nextCursorMove(resting, nodeTarget, { x: 200, y: 100 })
    expect(zoomed.travels).toBe(false)
    expect(cursorTransitionFor(false, zoomed.travels).duration).toBe(0)

    const dragged = nextCursorMove(zoomed, nodeTarget, { x: 260, y: 140 })
    expect(cursorTransitionFor(false, dragged.travels).duration).toBe(0)

    const newTarget = { kind: 'port', ref: { nodeId: OTHER, portId: 'a' } } as const
    const travel = nextCursorMove(dragged, newTarget, { x: 400, y: 160 })
    expect(travel.travels).toBe(true)
    expect(cursorTransitionFor(false, travel.travels).duration).toBeGreaterThan(0)

    expect(nextCursorMove(travel, newTarget, { x: 400, y: 160 })).toBe(travel)
  })
})
