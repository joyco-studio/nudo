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

function typeInto(input: HTMLInputElement, text: string): void {
  // The prototype's setter, so React's own value tracking on the element sees a change.
  Reflect.set(HTMLInputElement.prototype, 'value', text, input)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Opens the "I already have a key" disclosure and returns its input. */
function revealKeyInput(dialog: HTMLElement): HTMLInputElement {
  const toggle = buttonNamed(dialog, 'I already have a key')
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  act(() => {
    toggle.click()
  })
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  const input = dialog.querySelector<HTMLInputElement>('input')
  if (input === null) throw new Error('No key input')
  return input
}

function submitKey(dialog: HTMLElement, input: HTMLInputElement, text: string): void {
  act(() => {
    input.focus()
    typeInto(input, text)
  })
  act(() => {
    buttonNamed(dialog, 'Use this key').click()
  })
}

/** A bridge whose `adoptKey` answers `result` and, when adopted, switches to `adoptedKey`. */
function adoptingBridge(result: ReturnType<AgentBridgeHandle['adoptKey']>, adoptedKey = 'key-1') {
  let key = 'key-1'
  const adoptKey = vi.fn<AgentBridgeHandle['adoptKey']>(() => {
    if (result === 'adopted') key = adoptedKey
    return result
  })
  const bridge: AgentBridgeHandle = {
    url: URL,
    currentKey: () => key,
    connect: () => key,
    generateNewKey: () => 'key-2',
    subscribeKey: () => () => undefined,
    adoptKey,
  }
  return { bridge, adoptKey }
}

describe('AgentConnectDialog', () => {
  it("the connect dialog's command contains the url and the key header", () => {
    const dialog = openDialog({
      url: URL,
      currentKey: () => 'key-1',
      connect: () => 'key-1',
      generateNewKey: () => 'key-2',
      subscribeKey: () => () => undefined,
      adoptKey: () => 'invalid',
    })
    expect(commandIn(dialog)).toBe(
      `claude mcp add --scope user --transport http nudo ${URL}/mcp --header "Authorization: Bearer key-1"`,
    )
    expect(dialog.textContent).toContain('Anyone with this key can edit your open graph')
    expect(dialog.textContent).toContain('claude mcp remove nudo')
  })

  it('Generate new key changes the command and calls reconnect', () => {
    const generateNewKey = vi.fn(() => 'key-2')
    const dialog = openDialog({
      url: URL,
      currentKey: () => 'key-1',
      connect: () => 'key-1',
      generateNewKey,
      subscribeKey: () => () => undefined,
      adoptKey: () => 'invalid',
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
      adoptKey: () => 'invalid',
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
      adoptKey: () => 'unconfigured',
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
      adoptKey: () => 'invalid',
    }
    const dialog = openDialog(bridge)
    expect(dialog.textContent).toContain('Reload nudo')

    act(() => {
      useEditorStore.setState({ agentConnection: 'other-tab' })
    })
    expect(dialog.textContent).toContain('The agent is working in another tab')
  })

  it('reveals a labelled key field with a hint on where to find the key in use', () => {
    const { bridge } = adoptingBridge('invalid')
    const dialog = openDialog(bridge)
    expect(dialog.querySelector('input')).toBeNull()

    const input = revealKeyInput(dialog)

    expect(input.labels?.[0]?.textContent).toBe('Your key')
    expect(input.closest('form')).not.toBeNull()
    expect(dialog.textContent).toContain('claude mcp get nudo')
  })

  it('says why an invalid key was refused, linked to the field, and keeps focus there', () => {
    const { bridge, adoptKey } = adoptingBridge('invalid')
    const dialog = openDialog(bridge)
    const input = revealKeyInput(dialog)

    submitKey(dialog, input, 'not-a-key')

    expect(adoptKey).toHaveBeenCalledWith('not-a-key')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const errorId = (input.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .find((id) => document.getElementById(id)?.textContent.includes("isn't a nudo key"))
    expect(errorId).toBeDefined()
    expect(document.getElementById(errorId ?? '')?.getAttribute('role')).toBe('alert')
    expect(document.activeElement).toBe(input)
    expect(commandIn(dialog)).toContain('Bearer key-1')
  })

  it('uses a valid key: the command updates, it confirms and focus moves to Copy', () => {
    const { bridge, adoptKey } = adoptingBridge('adopted', 'pasted-key')
    const dialog = openDialog(bridge)
    const input = revealKeyInput(dialog)

    submitKey(dialog, input, 'Bearer pasted-key')

    expect(adoptKey).toHaveBeenCalledTimes(1)
    expect(commandIn(dialog)).toContain('Bearer pasted-key')
    expect(dialog.textContent).toContain('This browser now uses that key')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Copy command')
    expect(document.activeElement).not.toBe(document.body)
  })

  it('says so when the pasted key is already the one in use, and changes nothing', () => {
    const { bridge } = adoptingBridge('unchanged')
    const dialog = openDialog(bridge)
    const input = revealKeyInput(dialog)

    submitKey(dialog, input, 'key-1')

    expect(dialog.textContent).toContain('This browser already uses that key')
    expect(input.getAttribute('aria-invalid')).not.toBe('true')
    expect(commandIn(dialog)).toContain('Bearer key-1')
  })
})
