import { createGraph, serializeGraph } from '@nudo-tsl/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_PANEL_PREFS,
  PANELS_STORAGE_KEY,
  parsePanelPrefs,
  serializePanelPrefs,
} from '../features/panels/panel-state'
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

describe('bootstrapEditor panel preferences', () => {
  let stop: (() => void) | null = null

  beforeEach(() => {
    localStorage.clear()
    useEditorStore.setState({ panels: DEFAULT_PANEL_PREFS })
  })
  afterEach(() => {
    stop?.()
    stop = null
  })

  it('restores the stored panel layout and saves every change', () => {
    const stored = {
      ...DEFAULT_PANEL_PREFS,
      layout: 'split' as const,
      backdrop: 'checker-room' as const,
    }
    localStorage.setItem(PANELS_STORAGE_KEY, serializePanelPrefs(stored))

    stop = bootstrapEditor(localStorage, window)
    expect(useEditorStore.getState().panels).toEqual(stored)

    useEditorStore.getState().togglePanel('code')
    expect(parsePanelPrefs(localStorage.getItem(PANELS_STORAGE_KEY)).open.code).toBe(
      !stored.open.code,
    )
  })

  it('moves prefs saved before the grid to the grid, then keeps the next choice', () => {
    const legacyPrefs = { ...DEFAULT_PANEL_PREFS, backdrop: 'checker-room' as const }
    localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(legacyPrefs))

    stop = bootstrapEditor(localStorage, window)
    expect(useEditorStore.getState().panels.backdrop).toBe('grid')

    useEditorStore.getState().setPreviewBackdrop('checker-room')
    expect(parsePanelPrefs(localStorage.getItem(PANELS_STORAGE_KEY)).backdrop).toBe('checker-room')
  })
})
