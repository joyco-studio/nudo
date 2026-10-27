import { beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_PANEL_PREFS } from '@/features/panels/panel-state'

import { useEditorStore } from './editor-store'

const getState = () => useEditorStore.getState()
const historyLength = () => useEditorStore.temporal.getState().pastStates.length

beforeEach(() => {
  useEditorStore.setState({ panels: DEFAULT_PANEL_PREFS, layoutBeforeFull: 'docked' })
  useEditorStore.temporal.getState().clear()
})

describe('panel actions', () => {
  it('toggles a panel without touching the history', () => {
    getState().togglePanel('code')
    expect(getState().panels.open.code).toBe(!DEFAULT_PANEL_PREFS.open.code)
    expect(historyLength()).toBe(0)
  })

  it('cycles the layout and returns from full to the layout before it', () => {
    getState().cyclePreviewLayout()
    expect(getState().panels.layout).toBe('split')
    getState().cyclePreviewLayout()
    expect(getState().panels.layout).toBe('full')

    getState().exitFullPreview()
    expect(getState().panels.layout).toBe('split')
  })

  it('leaving full that was chosen from docked goes back to docked', () => {
    getState().setPreviewLayout('full')
    getState().exitFullPreview()
    expect(getState().panels.layout).toBe('docked')
  })

  it('choosing a layout opens a collapsed preview', () => {
    getState().togglePanel('preview')
    getState().setPreviewLayout('split')
    expect(getState().panels.open.preview).toBe(true)
  })

  it('clamps the split and stores the backdrop', () => {
    getState().setSplitPercent(5)
    expect(getState().panels.splitPercent).toBe(25)
    getState().setPreviewBackdrop('checker-room')
    expect(getState().panels.backdrop).toBe('checker-room')
  })
})
