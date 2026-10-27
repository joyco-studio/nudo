/**
 * An event target as an HTML element, or null (the window, an SVG node, nothing). Key handlers
 * pass it on as the opener a dialog or command gives focus back to.
 */
export function htmlElementOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target : null
}
