import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { I18nContext } from './i18n-context'
import type { I18nContextValue } from './i18n-context'
import { persistLocale, readInitialLocale } from './locale'
import type { Locale } from './locale'
import { en } from './messages/en'
import { es } from './messages/es'
import { createTranslator } from './translate'
import type { Translate } from './translate'

const TRANSLATORS: Readonly<Record<Locale, Translate>> = {
  en: createTranslator(en),
  es: createTranslator(es),
}

/** `window.localStorage` itself throws where storage is blocked. */
function browserStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

interface I18nProviderProps {
  children: ReactNode
}

/**
 * The UI language: the saved one (`nudo-tsl:locale`), else the browser's. Switching it re-renders
 * every message at once and updates `<html lang>`, so screen readers pick the right voice.
 */
export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    readInitialLocale(browserStorage(), navigator.language),
  )

  useLayoutEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    persistLocale(browserStorage(), next)
    setLocaleState(next)
  }, [])

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t: TRANSLATORS[locale] }),
    [locale, setLocale],
  )

  return <I18nContext value={value}>{children}</I18nContext>
}
