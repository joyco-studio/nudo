/** Development builds only: what the node previews cost. Used by e2e tests and frame budgets. */
export interface NodePreviewStats {
  /** Renders copied onto a node canvas. */
  renders: number
  /** Main-thread milliseconds spent rendering and copying, summed. */
  renderMs: number
  /** The slowest single render and copy, in milliseconds. */
  maxRenderMs: number
}

declare global {
  interface Window {
    __nudoNodePreviewStats?: NodePreviewStats
  }
}

/** Counts a node preview render on `window` in development builds. Production exposes nothing. */
export function recordNodePreviewRender(durationMs: number): void {
  if (!import.meta.env.DEV) return
  const stats = window.__nudoNodePreviewStats ?? { renders: 0, renderMs: 0, maxRenderMs: 0 }
  window.__nudoNodePreviewStats = {
    renders: stats.renders + 1,
    renderMs: stats.renderMs + durationMs,
    maxRenderMs: Math.max(stats.maxRenderMs, durationMs),
  }
}
