import { classifyKeyTarget } from '@/features/canvas/canvas-keyboard-model'

import { PANEL_IDS } from './panel-state'
import type { PanelId } from './panel-state'

/** Marks a panel header: panel letters work while focus is inside one. */
export const PANEL_HEADER_ATTRIBUTE = 'data-panel-header'

export type PanelShortcutAction =
  { readonly kind: 'toggle'; readonly panel: PanelId } | { readonly kind: 'cycle-layout' }

type PanelShortcutPress = Pick<
  KeyboardEvent,
  'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey' | 'repeat'
>

/** The letter that toggles each panel, as printed on the key cap. */
export const PANEL_SHORTCUT_KEYS: Readonly<Record<PanelId, string>> = {
  blackboard: 'B',
  inspector: 'I',
  preview: 'P',
  code: 'C',
}

const PANEL_BY_KEY: ReadonlyMap<string, PanelId> = new Map(
  PANEL_IDS.map((panel) => [PANEL_SHORTCUT_KEYS[panel].toLowerCase(), panel]),
)

/** B, I, P and C toggle a panel; Shift+P cycles the preview layout. Any other modifier: nothing. */
export function panelShortcutAction(press: PanelShortcutPress): PanelShortcutAction | null {
  if (press.ctrlKey || press.metaKey || press.altKey || press.repeat) return null
  const key = press.key.toLowerCase()
  if (press.shiftKey) return key === 'p' ? { kind: 'cycle-layout' } : null
  const panel = PANEL_BY_KEY.get(key)
  return panel === undefined ? null : { kind: 'toggle', panel }
}

/**
 * Panel letters fire only where they can't be typing or activating something else: the canvas, a
 * node or edge on it, a panel header, or the page itself when nothing has focus (for instance
 * after the focused element was covered by the full preview).
 */
export function isPanelShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target === document.body) return true
  const kind = classifyKeyTarget(target)
  if (kind === 'canvas' || kind === 'node' || kind === 'edge') return true
  return target.closest(`[${PANEL_HEADER_ATTRIBUTE}]`) !== null
}
