import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useEditorStore } from '@/store/editor-store'
import type { AgentTask } from '@/store/store-types'

import { AgentConfirmDialog } from './agent-confirm-dialog'
import { createConfirmBroker } from './confirm-broker'
import type { AgentConfirmKind, ConfirmBroker } from './confirm-broker'

const task: AgentTask = {
  agent: { sessionId: 's1', name: 'Claude Code' },
  prompt: null,
  implicit: true,
  startedAt: 0,
  steps: [],
  status: 'active',
  createdNodeIds: [],
  summary: null,
}

let container: HTMLDivElement
let root: Root
let broker: ConfirmBroker

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  broker = createConfirmBroker()
  act(() => {
    root.render(<AgentConfirmDialog broker={broker} />)
  })
})

afterEach(() => {
  act(() => {
    broker.answer(false)
    root.unmount()
  })
  container.remove()
  useEditorStore.setState({ agentTask: null })
})

function titleWhenAsked(kind: AgentConfirmKind): string {
  act(() => {
    void broker.request(kind)
  })
  const title = document.body.querySelector('[role="alertdialog"] h2')
  return title?.textContent ?? ''
}

describe('AgentConfirmDialog', () => {
  it('names the agent in the title when the task has one', () => {
    useEditorStore.setState({ agentTask: task })
    expect(titleWhenAsked('new_graph')).toBe('Let Claude Code start a new graph?')
  })

  it.each([
    ['new_graph', 'Let the agent start a new graph?'],
    ['load_template', 'Let the agent open a template?'],
    ['undo_all', "Undo all of the agent's changes?"],
  ] as const)('reads as a sentence with no agent name (%s)', (kind, title) => {
    expect(titleWhenAsked(kind)).toBe(title)
  })
})
