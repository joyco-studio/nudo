import { createGraph, serializeGraph } from '@nudo-tsl/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOSAVE_CORRUPT_KEY, AUTOSAVE_KEY, loadAutosave, startAutosave } from './autosave'
import { useEditorStore } from './editor-store'

const RESTORE_FAILED_NOTICE = {
  kind: 'error',
  message:
    "Couldn't restore your last session, so we started a new graph. The previous data was kept.",
} as const

function documentWith(overrides: Record<string, unknown>): string {
  return JSON.stringify({ ...createGraph(), ...overrides })
}

describe('loadAutosave', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns a fresh graph when storage is empty', () => {
    const result = loadAutosave(localStorage)

    expect(result.graph).toEqual(createGraph())
    expect(result.notice).toBeNull()
    expect(localStorage.getItem(AUTOSAVE_CORRUPT_KEY)).toBeNull()
  })

  it('restores a valid saved graph', () => {
    const saved = createGraph()
    localStorage.setItem(AUTOSAVE_KEY, serializeGraph(saved))

    const result = loadAutosave(localStorage)

    expect(result.graph).toEqual(saved)
    expect(result.notice).toBeNull()
  })

  it.each([
    ['corrupt JSON', '{not json'],
    [
      'an unknown node type',
      documentWith({
        nodes: {
          master: {
            id: 'master',
            type: 'master/stack',
            position: { x: 0, y: 0 },
            inputValues: {},
            params: {},
          },
          x: {
            id: 'x',
            type: 'nope/missing',
            position: { x: 0, y: 0 },
            inputValues: {},
            params: {},
          },
        },
      }),
    ],
    ['a future schemaVersion', documentWith({ schemaVersion: 99 })],
  ])('with %s returns a fresh graph, keeps the raw text and reports an error', (_name, raw) => {
    localStorage.setItem(AUTOSAVE_KEY, raw)

    const result = loadAutosave(localStorage)

    expect(result.graph).toEqual(createGraph())
    expect(result.notice).toEqual(RESTORE_FAILED_NOTICE)
    expect(localStorage.getItem(AUTOSAVE_CORRUPT_KEY)).toBe(raw)
  })
})

describe('startAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    useEditorStore.setState({ graph: createGraph() })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes the serialized graph after the 500ms debounce', () => {
    const stop = startAutosave(localStorage)

    useEditorStore.getState().addNode('input/float', { x: 1, y: 1 })
    vi.advanceTimersByTime(499)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()

    vi.advanceTimersByTime(1)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(serializeGraph(useEditorStore.getState().graph))
    stop()
  })

  it('collapses rapid changes into a single write with the latest graph', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const stop = startAutosave(localStorage)

    useEditorStore.getState().addNode('input/float', { x: 1, y: 1 })
    vi.advanceTimersByTime(300)
    useEditorStore.getState().addNode('input/uv', { x: 2, y: 2 })
    vi.advanceTimersByTime(500)

    expect(setItem).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(serializeGraph(useEditorStore.getState().graph))
    setItem.mockRestore()
    stop()
  })

  it('ignores changes that do not touch the graph', () => {
    const stop = startAutosave(localStorage)

    useEditorStore.getState().setSelection([])
    useEditorStore.getState().showNotice({ kind: 'info', message: 'hi' })
    vi.advanceTimersByTime(1000)

    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
    stop()
  })

  it('unsubscribe stops listening and clears a pending write', () => {
    const stop = startAutosave(localStorage)

    useEditorStore.getState().addNode('input/float', { x: 1, y: 1 })
    stop()
    vi.advanceTimersByTime(1000)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()

    useEditorStore.getState().addNode('input/uv', { x: 2, y: 2 })
    vi.advanceTimersByTime(1000)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
  })

  it('does not throw when storage rejects the write', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    const stop = startAutosave(localStorage)

    useEditorStore.getState().addNode('input/float', { x: 1, y: 1 })
    expect(() => vi.advanceTimersByTime(500)).not.toThrow()
    setItem.mockRestore()
    stop()
  })
})
