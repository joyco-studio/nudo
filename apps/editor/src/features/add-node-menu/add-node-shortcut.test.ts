import { afterEach, describe, expect, it } from 'vitest'

import { CANVAS_ID } from '@/shared/lib/landmarks'

import { addNodeShortcutOrigin } from './add-node-shortcut'

/** A canvas `main` holding a React Flow pane and one node with an input and a button inside. */
function renderCanvas(): Record<'canvas' | 'pane' | 'node' | 'input' | 'button', HTMLElement> {
  document.body.innerHTML = `
    <main id="${CANVAS_ID}" tabindex="-1">
      <div class="react-flow__pane"></div>
      <div class="react-flow__node" data-id="color" tabindex="0">
        <input aria-label="Value" />
        <button type="button">Port</button>
      </div>
    </main>
    <button type="button" id="outside">Outside</button>
  `
  const pick = (selector: string): HTMLElement => {
    const element = document.querySelector(selector)
    if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`)
    return element
  }
  return {
    canvas: pick(`#${CANVAS_ID}`),
    pane: pick('.react-flow__pane'),
    node: pick('.react-flow__node'),
    input: pick('input'),
    button: pick('.react-flow__node button'),
  }
}

function spaceOn(target: EventTarget, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, ...init })
  Object.defineProperty(event, 'target', { value: target })
  return event
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('addNodeShortcutOrigin', () => {
  it('places beside the node when Space is pressed on a focused node', () => {
    const { node } = renderCanvas()
    expect(addNodeShortcutOrigin(spaceOn(node))).toEqual({ kind: 'beside-node', nodeId: 'color' })
  })

  it('places at the viewport center when Space is pressed on the canvas or the pane', () => {
    const { canvas, pane } = renderCanvas()
    expect(addNodeShortcutOrigin(spaceOn(canvas))).toEqual({ kind: 'viewport-center' })
    expect(addNodeShortcutOrigin(spaceOn(pane))).toEqual({ kind: 'viewport-center' })
  })

  it('ignores Space inside text fields, buttons and anything outside the canvas', () => {
    const { input, button } = renderCanvas()
    const outside = document.getElementById('outside')
    expect(addNodeShortcutOrigin(spaceOn(input))).toBeNull()
    expect(addNodeShortcutOrigin(spaceOn(button))).toBeNull()
    expect(outside).not.toBeNull()
    if (outside !== null) expect(addNodeShortcutOrigin(spaceOn(outside))).toBeNull()
    expect(addNodeShortcutOrigin(spaceOn(document.body))).toBeNull()
  })

  it('ignores other keys, modifiers, key repeat and handled events', () => {
    const { node } = renderCanvas()
    expect(addNodeShortcutOrigin(spaceOn(node, { key: 'Enter' }))).toBeNull()
    expect(addNodeShortcutOrigin(spaceOn(node, { ctrlKey: true }))).toBeNull()
    expect(addNodeShortcutOrigin(spaceOn(node, { shiftKey: true }))).toBeNull()
    expect(addNodeShortcutOrigin(spaceOn(node, { repeat: true }))).toBeNull()

    const handled = spaceOn(node, { cancelable: true })
    handled.preventDefault()
    expect(addNodeShortcutOrigin(handled)).toBeNull()
  })
})
