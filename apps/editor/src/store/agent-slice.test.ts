import { asNodeId } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import { useEditorStore } from './editor-store'

const historyLength = () => useEditorStore.temporal.getState().pastStates.length

describe('agent slice', () => {
  it('agent changes never create undo entries', () => {
    const before = historyLength()
    const state = () => useEditorStore.getState()
    state().setAgentConnection('connected')
    state().setAgentTask({
      agent: { sessionId: 's1', name: 'Claude' },
      prompt: 'Make it glow',
      implicit: false,
      startedAt: 1,
      steps: [{ label: 'Add node', detail: null, state: 'current' }],
      status: 'active',
      createdNodeIds: [asNodeId('n1')],
    })
    state().setAgentPresence({
      target: { kind: 'point', position: { x: 1, y: 2 } },
      ghost: null,
      pendingWire: null,
    })
    expect(useEditorStore.getState().agentConnection).toBe('connected')
    expect(useEditorStore.getState().agentTask?.status).toBe('active')
    expect(historyLength()).toBe(before)
  })
})
