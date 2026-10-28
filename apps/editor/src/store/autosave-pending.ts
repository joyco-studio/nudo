declare global {
  interface Window {
    /**
     * Development builds only: true while an autosave write waits out its debounce. e2e tests wait
     * for it to clear before they read the saved document, instead of sleeping past the debounce.
     */
    __nudoAutosavePending?: boolean
  }
}

/** Records on `window`, in development builds, whether an autosave write is waiting to run. */
export function recordAutosavePending(isPending: boolean): void {
  if (!import.meta.env.DEV) return
  window.__nudoAutosavePending = isPending
}
