import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PANEL_PREFS,
  clampSplitPercent,
  defaultPanelPrefsFor,
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

describe('preview backdrop', () => {
  it('shows the grid floor to a first visit', () => {
    expect(DEFAULT_PANEL_PREFS.backdrop).toBe('grid')
    expect(parsePanelPrefs(null).backdrop).toBe('grid')
  })

  it('keeps a stored choice, grid included', () => {
    expect(parsePanelPrefs(JSON.stringify({ backdrop: 'grid' })).backdrop).toBe('grid')
    expect(parsePanelPrefs(JSON.stringify({ backdrop: 'none' })).backdrop).toBe('none')
  })

  it('falls back to the grid for an unknown backdrop', () => {
    expect(parsePanelPrefs(JSON.stringify({ backdrop: 'skybox' })).backdrop).toBe('grid')
  })
})

describe('defaultPanelPrefsFor', () => {
  it('opens Properties and Inspector on a wide screen', () => {
    expect(defaultPanelPrefsFor(false)).toEqual(DEFAULT_PANEL_PREFS)
  })

  it('starts Properties and Inspector collapsed on a narrow screen, so the canvas shows', () => {
    const narrow = defaultPanelPrefsFor(true)
    expect(narrow.open).toEqual({
      ...DEFAULT_PANEL_PREFS.open,
      blackboard: false,
      inspector: false,
    })
  })

  it('is only a default: stored preferences still win on a narrow screen', () => {
    const rawText = serializePanelPrefs(CUSTOM_PREFS)
    expect(parsePanelPrefs(rawText, defaultPanelPrefsFor(true))).toEqual(CUSTOM_PREFS)
    expect(parsePanelPrefs(null, defaultPanelPrefsFor(true))).toEqual(defaultPanelPrefsFor(true))
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
