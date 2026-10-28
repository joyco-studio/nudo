import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PANEL_PREFS,
  clampSplitPercent,
  defaultPanelPrefsFor,
  effectivePreviewLayout,
  PANEL_PREFS_VERSION,
  migratePanelPrefs,
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
      prefsVersion: PANEL_PREFS_VERSION,
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
    const current = (backdrop: string): string =>
      JSON.stringify({ backdrop, prefsVersion: PANEL_PREFS_VERSION })
    expect(parsePanelPrefs(current('grid')).backdrop).toBe('grid')
    expect(parsePanelPrefs(current('none')).backdrop).toBe('none')
  })

  it('falls back to the grid for an unknown backdrop', () => {
    expect(
      parsePanelPrefs(JSON.stringify({ backdrop: 'skybox', prefsVersion: PANEL_PREFS_VERSION }))
        .backdrop,
    ).toBe('grid')
  })
})

describe('backdrop migration', () => {
  const stored = (prefsVersion: unknown, backdrop: string): string =>
    JSON.stringify({ ...CUSTOM_PREFS, backdrop, prefsVersion })

  it('moves unversioned prefs to the grid, whatever backdrop they stored', () => {
    expect(parsePanelPrefs(JSON.stringify({ ...CUSTOM_PREFS })).backdrop).toBe('grid')
    expect(parsePanelPrefs(JSON.stringify({ ...CUSTOM_PREFS, backdrop: 'none' })).backdrop).toBe(
      'grid',
    )
  })

  it('moves older and unknown versions to the grid too', () => {
    expect(parsePanelPrefs(stored(1, 'checker-room')).backdrop).toBe('grid')
    expect(parsePanelPrefs(stored(1, 'none')).backdrop).toBe('grid')
    expect(parsePanelPrefs(stored('2', 'checker-room')).backdrop).toBe('grid')
    expect(parsePanelPrefs(stored(null, 'none')).backdrop).toBe('grid')
  })

  it('keeps the rest of the stored prefs while migrating', () => {
    expect(parsePanelPrefs(stored(1, 'checker-room'))).toEqual({
      ...CUSTOM_PREFS,
      backdrop: 'grid',
    })
  })

  it('keeps the backdrop of current-version prefs, checker room and none included', () => {
    expect(parsePanelPrefs(stored(PANEL_PREFS_VERSION, 'checker-room')).backdrop).toBe(
      'checker-room',
    )
    expect(parsePanelPrefs(stored(PANEL_PREFS_VERSION, 'none')).backdrop).toBe('none')
  })

  it('stamps the current version when serializing, so a saved choice is never migrated again', () => {
    const rawText = serializePanelPrefs(CUSTOM_PREFS)
    expect(JSON.parse(rawText)).toMatchObject({ prefsVersion: PANEL_PREFS_VERSION })
    expect(parsePanelPrefs(rawText).backdrop).toBe('checker-room')
  })

  it('falls back to the defaults, grid included, for missing or invalid storage', () => {
    expect(parsePanelPrefs(null).backdrop).toBe('grid')
    expect(parsePanelPrefs('{nope').backdrop).toBe('grid')
    expect(parsePanelPrefs('[]').backdrop).toBe('grid')
  })

  it('migratePanelPrefs only touches the backdrop of outdated versions', () => {
    expect(migratePanelPrefs(CUSTOM_PREFS, 1)).toEqual({ ...CUSTOM_PREFS, backdrop: 'grid' })
    expect(migratePanelPrefs(CUSTOM_PREFS, undefined)).toEqual({
      ...CUSTOM_PREFS,
      backdrop: 'grid',
    })
    expect(migratePanelPrefs(CUSTOM_PREFS, PANEL_PREFS_VERSION)).toBe(CUSTOM_PREFS)
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
