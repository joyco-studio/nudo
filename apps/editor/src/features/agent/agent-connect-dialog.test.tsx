import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/shared/ui/tooltip'
import { useEditorStore } from '@/store/editor-store'

import type { AgentBridgeHandle } from './agent-bridge'
import { AgentUiProvider } from './agent-ui-provider'
import { AgentWorkChip } from './agent-work-chip'
import { createConfirmBroker } from './confirm-broker'

const URL = 'https://nudo-mcp.example.workers.dev'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  useEditorStore.setState({ agentConnection: 'off', agentTask: null })
})

function openDialog(bridge: AgentBridgeHandle): HTMLElement {
  act(() => {
    root.render(
      <TooltipProvider>
        <AgentUiProvider bridge={bridge} confirmBroker={createConfirmBroker()}>
          <AgentWorkChip />
        </AgentUiProvider>
      </TooltipProvider>,
    )
  })
  act(() => {
    container.querySelector('button')?.click()
  })
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (dialog === null) throw new Error('The connect dialog did not open')
  return dialog
}

const commandIn = (dialog: HTMLElement): string => dialog.querySelector('code')?.textContent ?? ''

const buttonNamed = (dialog: HTMLElement, name: string): HTMLButtonElement => {
  const found = [...dialog.querySelectorAll('button')].find((button) =>
    button.textContent.includes(name),
  )
  if (found === undefined) throw new Error(`No "${name}" button`)
  return found
}

describe('AgentConnectDialog', () => {
  it("the connect dialog's command contains the url and the key header", () => {
    const dialog = openDialog({
      url: URL,
      currentKey: () => 'key-1',
      connect: () => 'key-1',
      generateNewKey: () => 'key-2',
      subscribeKey: () => () => undefined,
    })
    expect(commandIn(dialog)).toBe(
      `claude mcp add --transport http nudo ${URL}/mcp --header "Authorization: Bearer key-1"`,
    )
    expect(dialog.textContent).toContain('Anyone with this key can edit your open graph')
  })

  it('Generate new key changes the command and calls reconnect', () => {
    const generateNewKey = vi.fn(() => 'key-2')
    const dialog = openDialog({
      url: URL,
      currentKey: () => 'key-1',
      connect: () => 'key-1',
      generateNewKey,
      subscribeKey: () => () => undefined,
    })

    act(() => {
      buttonNamed(dialog, 'Generate new key').click()
    })

    expect(generateNewKey).toHaveBeenCalledTimes(1)
    expect(commandIn(dialog)).toContain('Bearer key-2')
    expect(commandIn(dialog)).not.toContain('key-1')
  })

  it('shows the key another tab generated while the dialog is open', () => {
    let key = 'key-1'
    const listeners = new Set<() => void>()
    const dialog = openDialog({
      url: URL,
      currentKey: () => key,
      connect: () => key,
      generateNewKey: () => key,
      subscribeKey: (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    })

    act(() => {
      key = 'key-from-other-tab'
      for (const listener of listeners) listener()
    })

    expect(commandIn(dialog)).toContain('Bearer key-from-other-tab')
  })

  it('says the connection is not configured when there is no url', () => {
    const connect = vi.fn(() => null)
    const dialog = openDialog({
      url: null,
      currentKey: () => null,
      connect,
      generateNewKey: () => null,
      subscribeKey: () => () => undefined,
    })
    expect(dialog.textContent).toContain('not set up')
    expect(dialog.querySelector('code')).toBeNull()
  })

  it('names the outdated and other-tab statuses in words', () => {
    useEditorStore.setState({ agentConnection: 'outdated' })
    const bridge: AgentBridgeHandle = {
      url: URL,
      currentKey: () => 'key-1',
      connect: () => 'key-1',
      generateNewKey: () => 'key-2',
      subscribeKey: () => () => undefined,
    }
    const dialog = openDialog(bridge)
    expect(dialog.textContent).toContain('Reload nudo')

    act(() => {
      useEditorStore.setState({ agentConnection: 'other-tab' })
    })
    expect(dialog.textContent).toContain('The agent is working in another tab')
  })
})
