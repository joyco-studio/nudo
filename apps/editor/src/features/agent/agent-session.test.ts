import { afterEach, describe, expect, it } from 'vitest'

import { useEditorStore } from '@/store/editor-store'
import type { AgentPresence, AgentTask } from '@/store/store-types'

import { clearPresenceWhenTaskEnds } from './agent-session'

const presence: AgentPresence = {
  target: { kind: 'point', position: { x: 0, y: 0 } },
  ghost: null,
  pendingWire: null,
}

const task = (status: AgentTask['status']): AgentTask => ({
  agent: { sessionId: 's1', name: 'Claude' },
  prompt: null,
  implicit: true,
  startedAt: 0,
  steps: [],
  status,
  createdNodeIds: [],
  summary: null,
})

afterEach(() => {
  useEditorStore.setState({ agentTask: null, agentPresence: null })
})

describe('clearPresenceWhenTaskEnds', () => {
  it.each(['stopped', 'finished'] as const)('clears the cursor once the task is %s', (status) => {
    useEditorStore.setState({ agentTask: task('active'), agentPresence: presence })
    const unsubscribe = clearPresenceWhenTaskEnds()

    useEditorStore.getState().setAgentTask(task(status))

    expect(useEditorStore.getState().agentPresence).toBeNull()
    unsubscribe()
  })

  it('keeps the cursor while the task stays active', () => {
    useEditorStore.setState({ agentTask: task('active'), agentPresence: presence })
    const unsubscribe = clearPresenceWhenTaskEnds()

    useEditorStore.getState().setAgentTask({ ...task('active'), steps: [] })

    expect(useEditorStore.getState().agentPresence).toBe(presence)
    unsubscribe()
  })
})
