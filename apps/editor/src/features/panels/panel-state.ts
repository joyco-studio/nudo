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

function parseOpen(input: unknown): PanelPrefs['open'] {
  const stored = isRecord(input) ? input : {}
  const isOpen = (id: PanelId): boolean => {
    const value = stored[id]
    return typeof value === 'boolean' ? value : DEFAULT_PANEL_PREFS.open[id]
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
export function parsePanelPrefs(rawText: string | null): PanelPrefs {
  const input = rawText === null ? null : parseJson(rawText)
  if (!isRecord(input)) return DEFAULT_PANEL_PREFS
  const { splitPercent } = input
  return {
    open: parseOpen(input.open),
    layout: oneOf(PREVIEW_LAYOUTS, input.layout) ?? DEFAULT_PANEL_PREFS.layout,
    splitPercent:
      typeof splitPercent === 'number'
        ? clampSplitPercent(splitPercent)
        : DEFAULT_PANEL_PREFS.splitPercent,
    backdrop: oneOf(PREVIEW_BACKDROPS, input.backdrop) ?? DEFAULT_PANEL_PREFS.backdrop,
  }
}

export function serializePanelPrefs(prefs: PanelPrefs): string {
  return JSON.stringify(prefs)
}

export function loadPanelPrefs(storage: Storage): PanelPrefs {
  try {
    return parsePanelPrefs(storage.getItem(PANELS_STORAGE_KEY))
  } catch {
    // Storage can be blocked (privacy settings): the defaults still work for this session.
    return DEFAULT_PANEL_PREFS
  }
}

export function savePanelPrefs(storage: Storage, prefs: PanelPrefs): void {
  try {
    storage.setItem(PANELS_STORAGE_KEY, serializePanelPrefs(prefs))
  } catch {
    // Storage can be blocked or full: the layout still applies for this session.
  }
}
