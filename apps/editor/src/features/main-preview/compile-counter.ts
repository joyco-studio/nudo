declare global {
  interface Window {
    /** Development builds only: how many times the preview compiled the graph. Used by e2e tests. */
    __nudoCompileCount?: number
  }
}

/** Counts a compile on `window` in development builds. Production builds expose nothing. */
export function recordCompile(): void {
  if (!import.meta.env.DEV) return
  window.__nudoCompileCount = (window.__nudoCompileCount ?? 0) + 1
}
