import { createGraph, serializeGraph } from '@nudo-tsl/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOSAVE_CORRUPT_KEY, AUTOSAVE_KEY, loadAutosave, startAutosave } from './autosave'
import { useEditorStore } from './editor-store'

const RESTORE_FAILED_NOTICE = {
  kind: 'error',
  messageKey: 'notice.restoreFailedKept',
  persistent: true,
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

  it('restores a phase-1 (schema v1) autosave through the migration chain', () => {
    localStorage.setItem(AUTOSAVE_KEY, documentWith({ schemaVersion: 1 }))

    const result = loadAutosave(localStorage)

    expect(result.graph).toEqual(createGraph())
    expect(result.notice).toBeNull()
    expect(localStorage.getItem(AUTOSAVE_CORRUPT_KEY)).toBeNull()
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

  it('does not claim the data was kept when copying it to the corrupt key fails', () => {
    localStorage.setItem(AUTOSAVE_KEY, '{not json')
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    const result = loadAutosave(localStorage)
    setItem.mockRestore()

    expect(result.graph).toEqual(createGraph())
    expect(result.notice).toEqual({
      kind: 'error',
      messageKey: 'notice.restoreFailed',
      persistent: true,
    })
    expect(localStorage.getItem(AUTOSAVE_CORRUPT_KEY)).toBeNull()
  })
})

describe('startAutosave', () => {
  let stopAutosave: (() => void) | null = null

  const startTrackedAutosave = (): (() => void) => {
    const stop = startAutosave(localStorage)
    stopAutosave = stop
    return stop
  }

  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    useEditorStore.setState({ graph: createGraph(), notice: null })
  })
  afterEach(() => {
    stopAutosave?.()
    stopAutosave = null
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('writes the serialized graph after the 500ms debounce', () => {
    startTrackedAutosave()

    useEditorStore.getState().addNode('input/float', { x: 1, y: 1 })
    vi.advanceTimersByTime(499)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()

    vi.advanceTimersByTime(1)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(serializeGraph(useEditorStore.getState().graph))
  })

  it('flags a write as pending on window until it lands, for e2e tests to wait on', () => {
    startTrackedAutosave()
    expect(window.__nudoAutosavePending ?? false).toBe(false)

    useEditorStore.getState().addNode('input/float', { x: 1, y: 1 })
    expect(window.__nudoAutosavePending).toBe(true)

    vi.advanceTimersByTime(500)
    expect(window.__nudoAutosavePending).toBe(false)
    expect(localStorage.getItem(AUTOSAVE_KEY)).not.toBeNull()
  })

  it('collapses rapid changes into a single write with the latest graph', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    startTrackedAutosave()

    useEditorStore.getState().addNode('input/float', { x: 1, y: 1 })
    vi.advanceTimersByTime(300)
    useEditorStore.getState().addNode('input/uv', { x: 2, y: 2 })
    vi.advanceTimersByTime(500)

    expect(setItem).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(serializeGraph(useEditorStore.getState().graph))
  })

  it('ignores changes that do not touch the graph', () => {
    startTrackedAutosave()

    useEditorStore.getState().setSelection([])
    useEditorStore.getState().showNotice({ kind: 'info', messageKey: 'notice.masterDelete' })
    vi.advanceTimersByTime(1000)

    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
  })

  it('unsubscribe stops listening and clears a pending write', () => {
    const stop = startTrackedAutosave()

    useEditorStore.getState().addNode('input/float', { x: 1, y: 1 })
    stop()
    vi.advanceTimersByTime(1000)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()

    useEditorStore.getState().addNode('input/uv', { x: 2, y: 2 })
    vi.advanceTimersByTime(1000)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
  })

  it('flushes a pending write immediately when the page is hidden', () => {
    stopAutosave = startAutosave(localStorage, undefined, window)

    useEditorStore.getState().addNode('input/float', { x: 1, y: 1 })
    window.dispatchEvent(new Event('pagehide'))

    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(serializeGraph(useEditorStore.getState().graph))
  })

  it('flushes a pending write when the document becomes hidden', () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    stopAutosave = startAutosave(localStorage, undefined, window)

    useEditorStore.getState().addNode('input/float', { x: 1, y: 1 })
    document.dispatchEvent(new Event('visibilitychange'))
    visibility.mockRestore()

    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(serializeGraph(useEditorStore.getState().graph))
  })

  it('does not write on page hide when nothing is pending', () => {
    stopAutosave = startAutosave(localStorage, undefined, window)

    window.dispatchEvent(new Event('pagehide'))

    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
  })

  it('stops flushing on page hide after unsubscribing', () => {
    const stop = startAutosave(localStorage, undefined, window)

    useEditorStore.getState().addNode('input/float', { x: 1, y: 1 })
    stop()
    window.dispatchEvent(new Event('pagehide'))

    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
  })

  it('shows an error notice instead of throwing when storage rejects the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    startTrackedAutosave()

    useEditorStore.getState().addNode('input/float', { x: 1, y: 1 })
    expect(() => vi.advanceTimersByTime(500)).not.toThrow()

    expect(useEditorStore.getState().notice).toEqual({
      kind: 'error',
      messageKey: 'notice.saveFailed',
    })
  })
})
