import { CANVAS_ID } from './landmarks'

/**
 * Puts focus back on the element that opened an overlay, or on the canvas when that element is
 * gone (it was removed, or nothing had focus).
 */
export function focusOpenerOrCanvas(opener: HTMLElement | null): void {
  const target = opener?.isConnected === true ? opener : document.getElementById(CANVAS_ID)
  target?.focus({ preventScroll: true })
}
