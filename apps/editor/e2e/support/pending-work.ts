import { expect, type Page } from '@playwright/test'

/**
 * Waits on the editor's debounced work through the flags development builds put on `window`
 * (`__nudoCompilePending`, `__nudoAutosavePending`), instead of sleeping past a debounce. A guard
 * that something did not happen ("no compile") then checks the moment the work is done, and fails
 * if the work did happen, however slow the machine.
 */

export async function compileCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__nudoCompileCount ?? 0)
}

async function isCompilePending(page: Page): Promise<boolean> {
  return page.evaluate(() => window.__nudoCompilePending ?? false)
}

async function isAutosavePending(page: Page): Promise<boolean> {
  return page.evaluate(() => window.__nudoAutosavePending ?? false)
}

/** The compile count once no compile waits out its debounce: every edit so far has compiled. */
export async function settledCompileCount(page: Page): Promise<number> {
  await expect.poll(() => isCompilePending(page)).toBe(false)
  return compileCount(page)
}

/** The compile count after the page's first compile, once nothing more is pending. */
export async function firstSettledCompileCount(page: Page): Promise<number> {
  await expect.poll(() => compileCount(page)).toBeGreaterThan(0)
  return settledCompileCount(page)
}

/** Resolves once no autosave write is pending: the stored document holds every edit so far. */
export async function waitForAutosave(page: Page): Promise<void> {
  await expect.poll(() => isAutosavePending(page)).toBe(false)
}
