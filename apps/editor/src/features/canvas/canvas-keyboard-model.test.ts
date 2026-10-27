import { asNodeId } from '@nudo-tsl/core'
import { afterEach, describe, expect, it } from 'vitest'

import { CANVAS_ID } from '@/shared/lib/landmarks'

import {
  canvasKeyIntent,
  classifyKeyTarget,
  nudgePositions,
  resolveActionNodeIds,
} from './canvas-keyboard-model'
import type { KeyTargetKind } from './canvas-keyboard-model'

const plain = { shiftKey: false, ctrlKey: false, metaKey: false, altKey: false }
const press = (key: string, modifiers: Partial<typeof plain> = {}) => ({
  key,
  ...plain,
  ...modifiers,
})

describe('canvasKeyIntent', () => {
  it('moves a focused node 10 px per arrow press and 50 px with Shift', () => {
    expect(canvasKeyIntent(press('ArrowRight'), 'node')).toEqual({
      kind: 'move-nodes',
      delta: { x: 10, y: 0 },
    })
    expect(canvasKeyIntent(press('ArrowUp', { shiftKey: true }), 'node')).toEqual({
      kind: 'move-nodes',
      delta: { x: 0, y: -50 },
    })
  })

  it('pans the view 40 px per arrow press and 160 px with Shift when the canvas is focused', () => {
    expect(canvasKeyIntent(press('ArrowLeft'), 'canvas')).toEqual({
      kind: 'pan',
      delta: { x: -40, y: 0 },
    })
    expect(canvasKeyIntent(press('ArrowDown', { shiftKey: true }), 'canvas')).toEqual({
      kind: 'pan',
      delta: { x: 0, y: 160 },
    })
  })

  it('deletes with Delete or Backspace on a node, an edge or the canvas', () => {
    for (const target of ['node', 'edge', 'canvas'] as const) {
      expect(canvasKeyIntent(press('Delete'), target)).toEqual({ kind: 'delete' })
      expect(canvasKeyIntent(press('Backspace'), target)).toEqual({ kind: 'delete' })
    }
  })

  it('opens the first field with Enter on a node', () => {
    expect(canvasKeyIntent(press('Enter'), 'node')).toEqual({ kind: 'edit-fields' })
  })

  it('returns from a field to its node with Escape', () => {
    expect(canvasKeyIntent(press('Escape'), 'field')).toEqual({ kind: 'leave-field' })
  })

  it('does nothing in fields, ports and elsewhere, so typing and ports keep their keys', () => {
    const ignored: KeyTargetKind[] = ['field', 'port', 'other']
    for (const target of ignored) {
      expect(canvasKeyIntent(press('ArrowRight'), target)).toBeNull()
      expect(canvasKeyIntent(press('Delete'), target)).toBeNull()
    }
    expect(canvasKeyIntent(press('Enter'), 'field')).toBeNull()
  })

  it('resizes the focused node 20 px with Alt and the arrow keys', () => {
    expect(canvasKeyIntent(press('ArrowRight', { altKey: true }), 'node')).toEqual({
      kind: 'resize-node',
      delta: { width: 20, height: 0 },
    })
    expect(canvasKeyIntent(press('ArrowUp', { altKey: true }), 'node')).toEqual({
      kind: 'resize-node',
      delta: { width: 0, height: -20 },
    })
    expect(canvasKeyIntent(press('ArrowUp', { altKey: true, ctrlKey: true }), 'node')).toBeNull()
  })

  it('does nothing when Ctrl, Cmd or Alt is held', () => {
    expect(canvasKeyIntent(press('ArrowRight', { ctrlKey: true }), 'node')).toBeNull()
    expect(canvasKeyIntent(press('Delete', { metaKey: true }), 'node')).toBeNull()
    expect(canvasKeyIntent(press('ArrowLeft', { altKey: true }), 'canvas')).toBeNull()
  })
})

describe('resolveActionNodeIds', () => {
  const a = asNodeId('a')
  const b = asNodeId('b')
  const c = asNodeId('c')

  it('acts on the whole selection when the focused node belongs to it', () => {
    expect(resolveActionNodeIds(a, [a, b])).toEqual([a, b])
  })

  it('acts on the focused node alone when it is outside the selection', () => {
    expect(resolveActionNodeIds(c, [a, b])).toEqual([c])
  })

  it('acts on the selection when no node has focus', () => {
    expect(resolveActionNodeIds(null, [a, b])).toEqual([a, b])
  })
})

describe('nudgePositions', () => {
  const a = asNodeId('a')
  const b = asNodeId('b')
  const graphNodes = { [a]: { position: { x: 0, y: 0 } }, [b]: { position: { x: 100, y: 50 } } }

  it('offsets each node from its graph position', () => {
    expect(nudgePositions(graphNodes, {}, [a, b], { x: 10, y: 0 })).toEqual({
      [a]: { x: 10, y: 0 },
      [b]: { x: 110, y: 50 },
    })
  })

  it('keeps accumulating on the draft during one burst', () => {
    const afterFirst = nudgePositions(graphNodes, {}, [a], { x: 10, y: 0 })
    expect(nudgePositions(graphNodes, afterFirst, [a], { x: 10, y: 0 })).toEqual({
      [a]: { x: 20, y: 0 },
    })
  })

  it('skips ids that are not in the graph', () => {
    expect(nudgePositions(graphNodes, {}, [asNodeId('ghost')], { x: 10, y: 0 })).toEqual({})
  })
})

describe('classifyKeyTarget', () => {
  function render(): Record<string, Element> {
    document.body.innerHTML = `
      <main id="${CANVAS_ID}" tabindex="-1">
        <div class="react-flow__pane"></div>
        <div class="react-flow__node" data-id="color" tabindex="0">
          <input aria-label="Value" />
          <button type="button" data-port-button>Port</button>
          <button type="button" id="plain-button">Plain</button>
        </div>
        <svg><g class="react-flow__edge" data-id="edge-1" tabindex="0"></g></svg>
      </main>
      <input id="outside-input" />
    `
    const pick = (selector: string): Element => {
      const element = document.querySelector(selector)
      if (element === null) throw new Error(`Missing ${selector}`)
      return element
    }
    return {
      canvas: pick(`#${CANVAS_ID}`),
      pane: pick('.react-flow__pane'),
      node: pick('.react-flow__node'),
      field: pick('.react-flow__node input'),
      port: pick('[data-port-button]'),
      plain: pick('#plain-button'),
      edge: pick('.react-flow__edge'),
      outside: pick('#outside-input'),
    }
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('names the canvas surfaces', () => {
    const els = render()
    expect(classifyKeyTarget(els.node ?? null)).toBe('node')
    expect(classifyKeyTarget(els.edge ?? null)).toBe('edge')
    expect(classifyKeyTarget(els.canvas ?? null)).toBe('canvas')
    expect(classifyKeyTarget(els.pane ?? null)).toBe('canvas')
  })

  it('tells node fields and port buttons apart', () => {
    const els = render()
    expect(classifyKeyTarget(els.field ?? null)).toBe('field')
    expect(classifyKeyTarget(els.port ?? null)).toBe('port')
  })

  it('treats anything else as other', () => {
    const els = render()
    expect(classifyKeyTarget(els.outside ?? null)).toBe('other')
    expect(classifyKeyTarget(els.plain ?? null)).toBe('other')
    expect(classifyKeyTarget(null)).toBe('other')
  })
})
