import { createGraph, serializeGraph } from '@nudo-tsl/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOSAVE_KEY } from '../store/autosave'
import { useEditorStore } from '../store/editor-store'
import { bootstrapEditor } from './bootstrap-editor'

const AUTOSAVE_DELAY_MS = 500

describe('bootstrapEditor', () => {
  let stop: (() => void) | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    useEditorStore.setState({ graph: createGraph(), notice: null })
    useEditorStore.temporal.getState().clear()
  })
  afterEach(() => {
    stop?.()
    stop = null
    vi.useRealTimers()
  })

  it('loads the saved graph without creating an undo step', () => {
    useEditorStore.getState().addNode('input/float', { x: 0, y: 0 })
    const saved = useEditorStore.getState().graph
    localStorage.setItem(AUTOSAVE_KEY, serializeGraph(saved))
    useEditorStore.setState({ graph: createGraph() })

    stop = bootstrapEditor(localStorage, window)

    expect(serializeGraph(useEditorStore.getState().graph)).toBe(serializeGraph(saved))
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(0)
    expect(useEditorStore.getState().notice).toBeNull()
  })

  it('shows the restore notice when the saved data is corrupt', () => {
    localStorage.setItem(AUTOSAVE_KEY, '{not json')

    stop = bootstrapEditor(localStorage, window)

    expect(useEditorStore.getState().graph).toEqual(createGraph())
    expect(useEditorStore.getState().notice?.kind).toBe('error')
  })

  it('starts autosave', () => {
    stop = bootstrapEditor(localStorage, window)

    useEditorStore.getState().addNode('input/float', { x: 0, y: 0 })
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)

    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(serializeGraph(useEditorStore.getState().graph))
  })

  it('flushes pending changes on page hide', () => {
    stop = bootstrapEditor(localStorage, window)

    useEditorStore.getState().addNode('input/float', { x: 0, y: 0 })
    window.dispatchEvent(new Event('pagehide'))

    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe(serializeGraph(useEditorStore.getState().graph))
  })
})
