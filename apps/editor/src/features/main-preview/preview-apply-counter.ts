declare global {
  interface Window {
    /** Development builds only: how many scrub previews reached a live uniform. Used by e2e tests. */
    __nudoPreviewApplyCount?: number
  }
}

/** Counts an in-place preview on `window` in development builds. Production builds expose nothing. */
export function recordPreviewApply(): void {
  if (!import.meta.env.DEV) return
  window.__nudoPreviewApplyCount = (window.__nudoPreviewApplyCount ?? 0) + 1
}
