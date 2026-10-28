/** The languages the editor UI speaks. Generated code and identifiers stay English. */
export const LOCALES = ['en', 'es'] as const
export type Locale = (typeof LOCALES)[number]

/** Keep in sync with the pre-paint script in `index.html`. */
export const LOCALE_STORAGE_KEY = 'nudo-tsl:locale'
const DEFAULT_LOCALE: Locale = 'en'

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value)
}

/** The browser's language picks the first locale: any Spanish (`es`, `es-AR`, …) is Spanish. */
export function localeFromLanguage(language: string | undefined): Locale {
  return language?.toLowerCase().startsWith('es') === true ? 'es' : DEFAULT_LOCALE
}

/** The saved locale, else the browser's. Blocked storage counts as nothing saved. */
export function readInitialLocale(
  storage: Storage | undefined,
  language: string | undefined,
): Locale {
  try {
    const stored = storage?.getItem(LOCALE_STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // Storage can be blocked (privacy settings, sandboxed iframes): fall back to the browser.
  }
  return localeFromLanguage(language)
}

export function persistLocale(storage: Storage | undefined, locale: Locale): void {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Storage can be blocked or full: the locale still applies for this session.
  }
}
