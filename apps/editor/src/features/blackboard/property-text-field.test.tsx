import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MessageKey } from '@/i18n/translate'

import { PropertyTextField } from './property-text-field'
import type { DraftOutcome } from './use-text-draft'

const REJECTION = 'property.error.emptyLabel'

/** Sets an input's value the way typing does, so React's onChange fires. */
function typeInto(input: HTMLInputElement, text: string): void {
  // The prototype's setter, so React's own value tracking on the element sees a change.
  Reflect.set(HTMLInputElement.prototype, 'value', text, input)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function press(input: HTMLInputElement, key: string): void {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

describe('PropertyTextField', () => {
  let container: HTMLDivElement
  let root: Root
  const commit = vi.fn<(text: string) => MessageKey | null>()
  const onDone = vi.fn<(outcome: DraftOutcome, via: 'key' | 'blur') => void>()

  function render(onInvalidBlur: 'keep' | 'revert'): HTMLInputElement {
    act(() => {
      root.render(
        <PropertyTextField
          accessibleName="Reference"
          font="mono"
          value="speed"
          commit={commit}
          onInvalidBlur={onInvalidBlur}
          onDone={onDone}
        />,
      )
    })
    const input = container.querySelector('input')
    if (input === null) throw new Error('No input rendered')
    return input
  }

  function message(): HTMLElement | null {
    return container.querySelector('[role="alert"]')
  }

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    commit.mockReset()
    onDone.mockReset()
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('commits the trimmed text on Enter', () => {
    commit.mockReturnValue(null)
    const input = render('keep')

    act(() => {
      typeInto(input, '  tiling ')
      press(input, 'Enter')
    })

    expect(commit).toHaveBeenCalledWith('tiling')
    expect(onDone).toHaveBeenCalledWith('committed', 'key')
    expect(message()).toBeNull()
  })

  it('shows a rejection linked to the field and keeps the typed text', () => {
    commit.mockReturnValue(REJECTION)
    const input = render('keep')

    act(() => {
      typeInto(input, '2x')
      press(input, 'Enter')
    })

    const alert = message()
    expect(alert?.textContent).toBe('Enter a name.')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(alert?.id)
    expect(input.value).toBe('2x')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('Escape reverts the text and clears the message', () => {
    commit.mockReturnValue(REJECTION)
    const input = render('keep')

    act(() => {
      typeInto(input, '2x')
      press(input, 'Enter')
    })
    act(() => {
      press(input, 'Escape')
    })

    expect(input.value).toBe('speed')
    expect(message()).toBeNull()
    expect(input.hasAttribute('aria-describedby')).toBe(false)
    expect(onDone).toHaveBeenCalledWith('cancelled', 'key')
  })

  it('leaving a rejected inline rename reverts it', () => {
    commit.mockReturnValue(REJECTION)
    const input = render('revert')

    act(() => {
      input.focus()
      typeInto(input, '')
    })
    act(() => {
      input.blur()
    })

    expect(input.value).toBe('speed')
    expect(onDone).toHaveBeenCalledWith('cancelled', 'blur')
  })
})
