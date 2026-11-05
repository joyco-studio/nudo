import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { asNodeId } from '@nudo-tsl/core'
import { ReactFlowProvider } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CANVAS_ID } from '@/shared/lib/landmarks'
import { useEditorStore } from '@/store/editor-store'
import type { AgentPresence, AgentTask } from '@/store/store-types'

import { AgentCreatedBadge } from './agent-editing-tag'
import { AgentPresenceLayer } from './agent-presence-layer'

const centerOn = vi.fn<(point: { x: number; y: number }) => void>()

vi.mock('@/features/canvas/use-panel-aware-view', () => ({
  usePanelAwareView: () => ({ fitAll: vi.fn(), frameNodes: vi.fn(), centerOn }),
}))

const CREATED_ID = asNodeId('created')
const OTHER_ID = asNodeId('other')

const task: AgentTask = {
  agent: { sessionId: 's1', name: 'Claude' },
  prompt: 'Make it glow',
  implicit: false,
  startedAt: 0,
  steps: [{ label: 'Adding a noise node', detail: null, state: 'current' }],
  status: 'active',
  createdNodeIds: [CREATED_ID],
  summary: null,
}

/** Far outside the (unmeasured, zero-size) canvas, so the edge indicator shows. */
const OFFSCREEN_POINT = { x: 500, y: 500 }

const presence: AgentPresence = {
  target: { kind: 'point', position: OFFSCREEN_POINT },
  ghost: null,
  pendingWire: null,
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  centerOn.mockClear()
  useEditorStore.setState({ agentTask: task, agentPresence: presence })
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  useEditorStore.setState({ agentTask: null, agentPresence: null })
})

function renderLayer() {
  act(() => {
    root.render(
      <ReactFlowProvider>
        <AgentPresenceLayer />
      </ReactFlowProvider>,
    )
  })
}

describe('AgentPresenceLayer', () => {
  it('the layer renders the agent name next to the cursor', () => {
    renderLayer()
    const cursor = container.querySelector('[data-agent-cursor]')
    expect(cursor?.textContent).toContain('Claude')
    expect(cursor?.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('renders nothing without a presence', () => {
    useEditorStore.setState({ agentPresence: null })
    renderLayer()
    expect(container.querySelector('[data-agent-cursor]')).toBeNull()
    expect(container.querySelector('button')).toBeNull()
  })

  it('the edge indicator is a focusable button that pans to the target on Enter', () => {
    renderLayer()
    const button = container.querySelector('button')
    if (button === null) throw new Error('No edge indicator')
    expect(button.type).toBe('button')
    expect(button.getAttribute('aria-label')).toBe('Claude is working here')
    expect(button.closest('[aria-hidden="true"]')).toBeNull()

    button.focus()
    expect(document.activeElement).toBe(button)
    // A native button turns Enter and Space into a click; jsdom does not synthesize it.
    act(() => {
      button.click()
    })
    expect(centerOn).toHaveBeenCalledExactlyOnceWith(OFFSCREEN_POINT)
  })

  it('moves focus to the canvas when the focused edge indicator goes away on its own', () => {
    const canvas = document.createElement('main')
    canvas.id = CANVAS_ID
    canvas.tabIndex = -1
    document.body.append(canvas)
    try {
      renderLayer()
      const button = container.querySelector('button')
      if (button === null) throw new Error('No edge indicator')
      button.focus()

      // The agent moves into view (the unmeasured canvas shows only its origin).
      act(() => {
        useEditorStore.setState({
          agentPresence: { ...presence, target: { kind: 'point', position: { x: 0, y: 0 } } },
        })
      })
      expect(container.querySelector('button')).toBeNull()
      expect(document.activeElement).toBe(canvas)
    } finally {
      canvas.remove()
    }
  })

  it('announces the current step in a polite status region', () => {
    renderLayer()
    const status = container.querySelector('[role="status"]')
    expect(status?.getAttribute('aria-live')).toBe('polite')
    expect(status?.textContent).toBe('Claude: Adding a noise node')
  })
})

describe('AgentCreatedBadge', () => {
  it('node-view shows "by {name}" only for nodes the current task created', () => {
    act(() => {
      root.render(
        <>
          <div data-node={CREATED_ID}>
            <AgentCreatedBadge nodeId={CREATED_ID} />
          </div>
          <div data-node={OTHER_ID}>
            <AgentCreatedBadge nodeId={OTHER_ID} />
          </div>
        </>,
      )
    })
    expect(container.querySelector(`[data-node="${CREATED_ID}"]`)?.textContent).toBe('by Claude')
    expect(container.querySelector(`[data-node="${OTHER_ID}"]`)?.textContent).toBe('')
  })
})
