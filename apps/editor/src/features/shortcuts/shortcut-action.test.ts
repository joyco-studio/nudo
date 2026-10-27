import { describe, expect, it } from 'vitest'

import { globalShortcutAction } from './shortcut-action'

const plain = {
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
}
const press = (key: string, modifiers: Partial<typeof plain> & { code?: string } = {}) => ({
  key,
  code: '',
  ...plain,
  ...modifiers,
})

describe('globalShortcutAction', () => {
  it('undoes with Ctrl or Cmd + Z', () => {
    expect(globalShortcutAction(press('z', { ctrlKey: true }))).toBe('undo')
    expect(globalShortcutAction(press('z', { metaKey: true }))).toBe('undo')
  })

  it('redoes with Ctrl/Cmd + Shift + Z and Ctrl + Y', () => {
    expect(globalShortcutAction(press('Z', { ctrlKey: true, shiftKey: true }))).toBe('redo')
    expect(globalShortcutAction(press('z', { metaKey: true, shiftKey: true }))).toBe('redo')
    expect(globalShortcutAction(press('y', { ctrlKey: true }))).toBe('redo')
    expect(globalShortcutAction(press('y', { metaKey: true }))).toBeNull()
  })

  it('copies, pastes and selects all with Ctrl or Cmd', () => {
    expect(globalShortcutAction(press('c', { ctrlKey: true }))).toBe('copy')
    expect(globalShortcutAction(press('v', { metaKey: true }))).toBe('paste')
    expect(globalShortcutAction(press('a', { ctrlKey: true }))).toBe('select-all')
  })

  it('fits the view with F and opens the shortcuts with ?', () => {
    expect(globalShortcutAction(press('f'))).toBe('fit-view')
    expect(globalShortcutAction(press('F', { shiftKey: true }))).toBe('fit-view')
    expect(globalShortcutAction(press('?', { shiftKey: true }))).toBe('show-shortcuts')
  })

  it('leaves F and ? alone when Ctrl, Cmd or Alt is held', () => {
    expect(globalShortcutAction(press('f', { ctrlKey: true }))).toBeNull()
    expect(globalShortcutAction(press('f', { metaKey: true }))).toBeNull()
    expect(globalShortcutAction(press('?', { altKey: true }))).toBeNull()
  })

  it('ignores Alt chords and unrelated keys', () => {
    expect(globalShortcutAction(press('z', { ctrlKey: true, altKey: true }))).toBeNull()
    expect(globalShortcutAction(press('c', { ctrlKey: true, shiftKey: true }))).toBeNull()
    expect(globalShortcutAction(press('x', { ctrlKey: true }))).toBeNull()
    expect(globalShortcutAction(press('q'))).toBeNull()
  })

  it('starts a new graph with Ctrl or Cmd + Alt + N, whatever character Alt types', () => {
    expect(globalShortcutAction(press('n', { ctrlKey: true, altKey: true, code: 'KeyN' }))).toBe(
      'new-graph',
    )
    // On a Mac, Option+N types a dead key; the physical key still says N.
    expect(globalShortcutAction(press('Dead', { metaKey: true, altKey: true, code: 'KeyN' }))).toBe(
      'new-graph',
    )
    expect(globalShortcutAction(press('n', { altKey: true, code: 'KeyN' }))).toBeNull()
    expect(globalShortcutAction(press('n', { ctrlKey: true, code: 'KeyN' }))).toBeNull()
    expect(
      globalShortcutAction(press('n', { ctrlKey: true, altKey: true, code: 'KeyN', repeat: true })),
    ).toBeNull()
  })

  it('repeats only undo and redo while a key is held', () => {
    expect(globalShortcutAction(press('z', { ctrlKey: true, repeat: true }))).toBe('undo')
    expect(globalShortcutAction(press('v', { ctrlKey: true, repeat: true }))).toBeNull()
    expect(globalShortcutAction(press('f', { repeat: true }))).toBeNull()
  })
})
