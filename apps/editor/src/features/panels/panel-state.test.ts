import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PANEL_PREFS,
  clampSplitPercent,
  effectivePreviewLayout,
  nextPreviewLayout,
  parsePanelPrefs,
  serializePanelPrefs,
} from './panel-state'
import type { PanelPrefs } from './panel-state'

const CUSTOM_PREFS: PanelPrefs = {
  open: { blackboard: false, inspector: true, preview: false, code: true },
  layout: 'split',
  splitPercent: 40,
  backdrop: 'checker-room',
}

describe('parsePanelPrefs', () => {
  it('round-trips through serialize', () => {
    expect(parsePanelPrefs(serializePanelPrefs(CUSTOM_PREFS))).toEqual(CUSTOM_PREFS)
  })

  it('falls back to the defaults when nothing is stored or the text is not JSON', () => {
    expect(parsePanelPrefs(null)).toEqual(DEFAULT_PANEL_PREFS)
    expect(parsePanelPrefs('{nope')).toEqual(DEFAULT_PANEL_PREFS)
    expect(parsePanelPrefs('[]')).toEqual(DEFAULT_PANEL_PREFS)
  })

  it('keeps every valid field and replaces only the invalid ones', () => {
    const rawText = JSON.stringify({
      open: { blackboard: false, inspector: 'yes', code: true },
      layout: 'floating',
      splitPercent: 90,
      backdrop: 'checker-room',
    })
    expect(parsePanelPrefs(rawText)).toEqual({
      open: { ...DEFAULT_PANEL_PREFS.open, blackboard: false, code: true },
      layout: DEFAULT_PANEL_PREFS.layout,
      splitPercent: 75,
      backdrop: 'checker-room',
    })
  })
})

describe('preview layout', () => {
  it('cycles docked, split, full and back', () => {
    expect(nextPreviewLayout('docked')).toBe('split')
    expect(nextPreviewLayout('split')).toBe('full')
    expect(nextPreviewLayout('full')).toBe('docked')
  })

  it('shows a collapsed preview docked, whatever its layout', () => {
    expect(effectivePreviewLayout(CUSTOM_PREFS)).toBe('docked')
    expect(
      effectivePreviewLayout({ ...CUSTOM_PREFS, open: { ...CUSTOM_PREFS.open, preview: true } }),
    ).toBe('split')
  })
})

describe('clampSplitPercent', () => {
  it('keeps the canvas between a quarter and three quarters, in whole percents', () => {
    expect(clampSplitPercent(10)).toBe(25)
    expect(clampSplitPercent(80)).toBe(75)
    expect(clampSplitPercent(42.6)).toBe(43)
    expect(clampSplitPercent(Number.NaN)).toBe(DEFAULT_PANEL_PREFS.splitPercent)
  })
})
