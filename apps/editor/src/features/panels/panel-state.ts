/** localStorage key for the panel layout preferences (ruling P2-R2). */
export const PANELS_STORAGE_KEY = 'nudo-tsl:panels'

export const PANEL_IDS = ['blackboard', 'inspector', 'preview', 'code'] as const
export type PanelId = (typeof PANEL_IDS)[number]

/** Docked: floating column. Split: canvas and preview side by side. Full: preview fills the workspace. */
export const PREVIEW_LAYOUTS = ['docked', 'split', 'full'] as const
export type PreviewLayout = (typeof PREVIEW_LAYOUTS)[number]
export type NonFullPreviewLayout = Exclude<PreviewLayout, 'full'>

export const PREVIEW_BACKDROPS = ['none', 'checker-room'] as const
export type PreviewBackdrop = (typeof PREVIEW_BACKDROPS)[number]

export interface PanelPrefs {
  readonly open: Readonly<Record<PanelId, boolean>>
  readonly layout: PreviewLayout
  /** Share of the workspace width the canvas keeps in split layout, in whole percents. */
  readonly splitPercent: number
  readonly backdrop: PreviewBackdrop
}

export const SPLIT_PERCENT_MIN = 25
export const SPLIT_PERCENT_MAX = 75
/** How far one arrow key press moves the split divider. */
export const SPLIT_PERCENT_STEP = 5

export const DEFAULT_PANEL_PREFS: PanelPrefs = {
  open: { blackboard: true, inspector: true, preview: true, code: false },
  layout: 'docked',
  splitPercent: 50,
  backdrop: 'none',
}

/**
 * Below this width the panels stack in one column over the canvas, so Properties and Inspector
 * start collapsed there and the canvas stays visible.
 */
export const NARROW_SCREEN_QUERY = '(max-width: 767px)'

/** The layout a first visit gets: wide screens open Properties and Inspector, narrow ones don't. */
export function defaultPanelPrefsFor(isNarrow: boolean): PanelPrefs {
  if (!isNarrow) return DEFAULT_PANEL_PREFS
  return {
    ...DEFAULT_PANEL_PREFS,
    open: { ...DEFAULT_PANEL_PREFS.open, blackboard: false, inspector: false },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function oneOf<const T extends readonly string[]>(options: T, value: unknown): T[number] | null {
  return options.find((option) => option === value) ?? null
}

export function clampSplitPercent(percent: number): number {
  if (!Number.isFinite(percent)) return DEFAULT_PANEL_PREFS.splitPercent
  return Math.min(SPLIT_PERCENT_MAX, Math.max(SPLIT_PERCENT_MIN, Math.round(percent)))
}

export function nextPreviewLayout(layout: PreviewLayout): PreviewLayout {
  const index = PREVIEW_LAYOUTS.indexOf(layout)
  return PREVIEW_LAYOUTS[(index + 1) % PREVIEW_LAYOUTS.length] ?? 'docked'
}

/** A collapsed preview is only a header, so it sits in the docked column whatever its layout. */
export function effectivePreviewLayout(prefs: PanelPrefs): PreviewLayout {
  return prefs.open.preview ? prefs.layout : 'docked'
}

function parseOpen(input: unknown, defaults: PanelPrefs['open']): PanelPrefs['open'] {
  const stored = isRecord(input) ? input : {}
  const isOpen = (id: PanelId): boolean => {
    const value = stored[id]
    return typeof value === 'boolean' ? value : defaults[id]
  }
  return {
    blackboard: isOpen('blackboard'),
    inspector: isOpen('inspector'),
    preview: isOpen('preview'),
    code: isOpen('code'),
  }
}

function parseJson(rawText: string): unknown {
  try {
    return JSON.parse(rawText)
  } catch {
    return null
  }
}

/** Validates stored preferences field by field: an invalid field falls back to its default. */
export function parsePanelPrefs(
  rawText: string | null,
  defaults: PanelPrefs = DEFAULT_PANEL_PREFS,
): PanelPrefs {
  const input = rawText === null ? null : parseJson(rawText)
  if (!isRecord(input)) return defaults
  const { splitPercent } = input
  return {
    open: parseOpen(input.open, defaults.open),
    layout: oneOf(PREVIEW_LAYOUTS, input.layout) ?? defaults.layout,
    splitPercent:
      typeof splitPercent === 'number' ? clampSplitPercent(splitPercent) : defaults.splitPercent,
    backdrop: oneOf(PREVIEW_BACKDROPS, input.backdrop) ?? defaults.backdrop,
  }
}

export function serializePanelPrefs(prefs: PanelPrefs): string {
  return JSON.stringify(prefs)
}

export function loadPanelPrefs(
  storage: Storage,
  defaults: PanelPrefs = DEFAULT_PANEL_PREFS,
): PanelPrefs {
  try {
    return parsePanelPrefs(storage.getItem(PANELS_STORAGE_KEY), defaults)
  } catch {
    // Storage can be blocked (privacy settings): the defaults still work for this session.
    return defaults
  }
}

export function savePanelPrefs(storage: Storage, prefs: PanelPrefs): void {
  try {
    storage.setItem(PANELS_STORAGE_KEY, serializePanelPrefs(prefs))
  } catch {
    // Storage can be blocked or full: the layout still applies for this session.
  }
}
