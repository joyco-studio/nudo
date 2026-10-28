declare global {
  interface Window {
    /** Development builds only: how many times the preview compiled the graph. Used by e2e tests. */
    __nudoCompileCount?: number
    /**
     * Development builds only: true while a compile waits out its debounce. e2e tests wait for it
     * to clear before they compare compile counts, instead of sleeping past the debounce.
     */
    __nudoCompilePending?: boolean
  }
}

/** Counts a compile on `window` in development builds. Production builds expose nothing. */
export function recordCompile(): void {
  if (!import.meta.env.DEV) return
  window.__nudoCompileCount = (window.__nudoCompileCount ?? 0) + 1
}

/** Records on `window`, in development builds, whether a compile is waiting to run. */
export function recordCompilePending(isPending: boolean): void {
  if (!import.meta.env.DEV) return
  window.__nudoCompilePending = isPending
}
