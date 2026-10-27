import { afterEach, describe, expect, it } from 'vitest'

import { CANVAS_ID } from '@/shared/lib/landmarks'

import {
  PANEL_HEADER_ATTRIBUTE,
  isPanelShortcutTarget,
  panelShortcutAction,
} from './panel-shortcut-action'

const plain = { shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: false }
const press = (key: string, modifiers: Partial<typeof plain> = {}) => ({
  key,
  ...plain,
  ...modifiers,
})

describe('panelShortcutAction', () => {
  it('toggles a panel with its plain letter, whatever the case', () => {
    expect(panelShortcutAction(press('b'))).toEqual({ kind: 'toggle', panel: 'blackboard' })
    expect(panelShortcutAction(press('i'))).toEqual({ kind: 'toggle', panel: 'inspector' })
    expect(panelShortcutAction(press('p'))).toEqual({ kind: 'toggle', panel: 'preview' })
    expect(panelShortcutAction(press('C'))).toEqual({ kind: 'toggle', panel: 'code' })
  })

  it('cycles the preview layout with Shift+P', () => {
    expect(panelShortcutAction(press('P', { shiftKey: true }))).toEqual({ kind: 'cycle-layout' })
  })

  it('leaves modified and held keys alone', () => {
    expect(panelShortcutAction(press('c', { ctrlKey: true }))).toBeNull()
    expect(panelShortcutAction(press('c', { metaKey: true }))).toBeNull()
    expect(panelShortcutAction(press('b', { altKey: true }))).toBeNull()
    expect(panelShortcutAction(press('B', { shiftKey: true }))).toBeNull()
    expect(panelShortcutAction(press('b', { repeat: true }))).toBeNull()
    expect(panelShortcutAction(press('x'))).toBeNull()
  })
})

describe('isPanelShortcutTarget', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('accepts the canvas, a node, a panel header and the page itself', () => {
    const canvas = document.createElement('main')
    canvas.id = CANVAS_ID
    const node = document.createElement('div')
    node.className = 'react-flow__node'
    const header = document.createElement('div')
    header.setAttribute(PANEL_HEADER_ATTRIBUTE, '')
    const headerButton = document.createElement('button')
    header.append(headerButton)
    document.body.append(canvas, node, header)

    expect(isPanelShortcutTarget(canvas)).toBe(true)
    expect(isPanelShortcutTarget(node)).toBe(true)
    expect(isPanelShortcutTarget(headerButton)).toBe(true)
    expect(isPanelShortcutTarget(document.body)).toBe(true)
  })

  it('rejects fields and other controls', () => {
    const node = document.createElement('div')
    node.className = 'react-flow__node'
    const field = document.createElement('input')
    node.append(field)
    const button = document.createElement('button')
    document.body.append(node, button)

    expect(isPanelShortcutTarget(field)).toBe(false)
    expect(isPanelShortcutTarget(button)).toBe(false)
    expect(isPanelShortcutTarget(null)).toBe(false)
  })
})
