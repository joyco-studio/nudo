import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { trackInputModality } from '@/shared/lib/input-modality'
import { TooltipProvider } from '@/shared/ui/tooltip'
import { useEditorStore } from '@/store/editor-store'
import type { AgentTask } from '@/store/store-types'

import { AgentActivityPanel } from './agent-activity-panel'
import type { AgentBridgeHandle } from './agent-bridge'
import { AgentUiProvider } from './agent-ui-provider'
import { AgentWorkChip } from './agent-work-chip'
import { createConfirmBroker } from './confirm-broker'
import { beginSnapshot, discardSnapshot } from './undo-all'

const task: AgentTask = {
  agent: { sessionId: 's1', name: 'Claude Code' },
  prompt: 'Make the foil feel like crushed glass',
  implicit: false,
  startedAt: Date.now(),
  steps: [
    { label: 'Read graph', detail: '6 nodes', state: 'done' },
    { label: 'Adding Voronoi', detail: 'step 3 of 4', state: 'current' },
    { label: 'Connect to Roughness', detail: null, state: 'pending' },
  ],
  status: 'active',
  createdNodeIds: [],
  summary: null,
}

const bridge: AgentBridgeHandle = {
  url: 'http://localhost:8787',
  currentKey: () => 'key-1',
  connect: () => 'key-1',
  generateNewKey: () => 'key-2',
}

/** jsdom has no ResizeObserver; the chip's Radix tooltip measures with one when it takes focus. */
class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', NoopResizeObserver)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  useEditorStore.setState({ agentConnection: 'connected', agentTask: task })
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  discardSnapshot()
  vi.unstubAllGlobals()
  useEditorStore.setState({ agentConnection: 'off', agentTask: null })
})

function mount(): void {
  act(() => {
    root.render(
      <TooltipProvider>
        <AgentUiProvider bridge={bridge} confirmBroker={createConfirmBroker()}>
          <AgentWorkChip />
          <AgentActivityPanel />
        </AgentUiProvider>
      </TooltipProvider>,
    )
  })
}

const panel = (): HTMLElement | null => container.querySelector('section')

const buttonNamed = (name: string): HTMLButtonElement => {
  const found = [...container.querySelectorAll('button')].find((button) =>
    button.textContent.includes(name),
  )
  if (found === undefined) throw new Error(`No "${name}" button`)
  return found
}

/** A stopped task does not open the panel by itself; the person opens it from the chip. */
function openPanelFromChip(): void {
  act(() => {
    container.querySelector<HTMLButtonElement>('button[aria-expanded]')?.click()
  })
}

describe('AgentActivityPanel', () => {
  it('is a labeled region with the quoted prompt and every step', () => {
    mount()
    const region = panel()
    expect(region?.getAttribute('aria-label')).toBe('Claude Code activity')
    expect(region?.textContent).toContain('“Make the foil feel like crushed glass”')
    expect(region?.textContent).toContain('Read graph')
    expect(region?.textContent).toContain('step 3 of 4')
    expect(region?.querySelector('[aria-current="step"]')?.textContent).toContain('Adding Voronoi')
  })

  it('Stop is reachable by Tab and sets the task to stopped; Let it continue resumes', () => {
    mount()
    const stop = buttonNamed('Stop')
    expect(stop.tagName).toBe('BUTTON')
    expect(stop.disabled).toBe(false)
    expect(stop.getAttribute('tabindex')).not.toBe('-1')

    act(() => {
      stop.click()
    })
    expect(useEditorStore.getState().agentTask?.status).toBe('stopped')
    expect(panel()?.querySelector('h2')?.textContent).toBe('Claude Code · stopped')
    // The name stands out from the status around it, which stays in one translatable message.
    expect(panel()?.querySelector('h2 > span')?.textContent).toBe('Claude Code')

    act(() => {
      buttonNamed('Let it continue').click()
    })
    expect(useEditorStore.getState().agentTask?.status).toBe('active')
  })

  it('Undo all asks for confirmation when the user edited during the task', async () => {
    beginSnapshot()
    mount()
    act(() => {
      const store = useEditorStore.getState()
      store.replaceGraph({ ...store.graph })
    })

    act(() => {
      buttonNamed('Undo all').click()
    })

    await vi.waitFor(() => {
      expect(document.body.querySelector('[role="alertdialog"]')).not.toBeNull()
    })
  })

  it('keeps focus in the stopped panel after Undo all disables its button', async () => {
    useEditorStore.setState({ agentTask: { ...task, status: 'stopped' } })
    beginSnapshot()
    mount()
    openPanelFromChip()
    const undo = buttonNamed('Undo all')
    await act(async () => {
      undo.focus()
      undo.click()
      await Promise.resolve()
    })

    expect(undo.disabled).toBe(true)
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toBe(panel())
  })

  it('gives focus back to the stopped panel after Undo all is confirmed', async () => {
    useEditorStore.setState({ agentTask: { ...task, status: 'stopped' } })
    beginSnapshot()
    mount()
    openPanelFromChip()
    act(() => {
      const store = useEditorStore.getState()
      store.replaceGraph({ ...store.graph })
    })
    const undo = buttonNamed('Undo all')
    act(() => {
      undo.focus()
      undo.click()
    })
    const dialog = await vi.waitFor(() => {
      const found = document.body.querySelector<HTMLElement>('[role="alertdialog"]')
      if (found === null) throw new Error('No confirm dialog yet')
      return found
    })
    const confirm = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent === 'Undo all',
    )

    await act(async () => {
      confirm?.click()
      await Promise.resolve()
    })

    await vi.waitFor(() => {
      expect(document.body.querySelector('[role="alertdialog"]')).toBeNull()
      expect(document.activeElement).not.toBe(document.body)
      expect(document.activeElement).toBe(panel())
    })
  })

  it('hands focus to the chip when Undo all finishes an active task and the panel collapses', async () => {
    const stopTracking = trackInputModality(document)
    beginSnapshot()
    mount()
    const undo = buttonNamed('Undo all')
    await act(async () => {
      undo.focus()
      undo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      undo.click()
      await Promise.resolve()
    })

    expect(useEditorStore.getState().agentTask?.status).toBe('finished')
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toBe(container.querySelector('button[aria-expanded]'))
    stopTracking()
  })

  it('Escape collapses the panel and focuses the chip', () => {
    // Escape is a key press: the panel leaves at once (the frequency gate), as in the app.
    const stopTracking = trackInputModality(document)
    mount()
    expect(panel()).not.toBeNull()
    act(() => {
      buttonNamed('Stop').focus()
    })

    act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })

    expect(panel()).toBeNull()
    const chip = container.querySelector('button[aria-expanded]')
    expect(document.activeElement).toBe(chip)
    expect(chip?.getAttribute('aria-expanded')).toBe('false')
    stopTracking()
  })
})
