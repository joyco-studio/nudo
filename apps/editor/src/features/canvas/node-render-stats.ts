declare global {
  interface Window {
    /**
     * Development builds only: how many times a node view (card, comment frame or reroute) ran
     * its render. Used by e2e frame budgets: a drag must not render every node on every frame.
     */
    __nudoNodeRenderCount?: number
  }
}

/** Counts a node view render on `window` in development builds. Production exposes nothing. */
export function recordNodeRender(): void {
  if (!import.meta.env.DEV) return
  window.__nudoNodeRenderCount = (window.__nudoNodeRenderCount ?? 0) + 1
}
