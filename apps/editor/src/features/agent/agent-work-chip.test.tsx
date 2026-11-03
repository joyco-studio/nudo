import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/shared/ui/tooltip'
import { useEditorStore } from '@/store/editor-store'
import type { AgentTask } from '@/store/store-types'

import type { AgentBridgeHandle } from './agent-bridge'
import { AgentUiProvider } from './agent-ui-provider'
import { AgentWorkChip } from './agent-work-chip'
import { createConfirmBroker } from './confirm-broker'

const NOW = 1_000_000
const ELAPSED_MS = 14_000

const workingTask: AgentTask = {
  agent: { sessionId: 's1', name: 'Claude Code' },
  prompt: 'Make the foil feel like crushed glass',
  implicit: false,
  startedAt: NOW - ELAPSED_MS,
  steps: [
    { label: 'Read graph', detail: '6 nodes', state: 'done' },
    { label: 'Adding Voronoi', detail: 'step 3 of 4', state: 'current' },
  ],
  status: 'active',
  createdNodeIds: [],
  summary: null,
}

const fakeBridge = (): AgentBridgeHandle => ({
  url: 'http://localhost:8787',
  currentKey: vi.fn(() => 'key-1'),
  connect: vi.fn(() => 'key-1'),
  generateNewKey: vi.fn(() => 'key-2'),
})

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(NOW)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  vi.useRealTimers()
  useEditorStore.setState({ agentConnection: 'off', agentTask: null, agentPresence: null })
})

function mount(bridge: AgentBridgeHandle = fakeBridge()): void {
  act(() => {
    root.render(
      <TooltipProvider>
        <AgentUiProvider bridge={bridge} confirmBroker={createConfirmBroker()}>
          <AgentWorkChip />
        </AgentUiProvider>
      </TooltipProvider>,
    )
  })
}

const chip = (): HTMLButtonElement => {
  const button = container.querySelector('button')
  if (button === null) throw new Error('No chip rendered')
  return button
}

describe('AgentWorkChip', () => {
  it('the chip shows the current step and elapsed time during a task', () => {
    useEditorStore.setState({ agentConnection: 'connected', agentTask: workingTask })
    mount()
    expect(chip().textContent).toContain('Adding Voronoi')
    expect(chip().textContent).toContain('0:14')
    expect(chip().getAttribute('aria-expanded')).not.toBeNull()
  })

  it('names the step a stopped agent was on, in one translatable message', () => {
    useEditorStore.setState({
      agentConnection: 'connected',
      agentTask: { ...workingTask, status: 'stopped' },
    })
    mount()
    expect(chip().textContent).toBe('Stopped · Adding Voronoi')
  })

  it('offers to connect an agent while disconnected and opens the connect dialog', () => {
    const bridge = fakeBridge()
    mount(bridge)
    expect(chip().textContent).toContain('Connect an agent')

    act(() => {
      chip().click()
    })

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(bridge.connect).toHaveBeenCalled()
  })

  it('says the agent is connected when it is idle', () => {
    useEditorStore.setState({ agentConnection: 'connected' })
    mount()
    expect(chip().textContent).toContain('Agent connected')
  })
})
