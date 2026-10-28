import { createContext } from 'react'

import type { Locale } from './locale'
import type { Translate } from './translate'

export interface I18nContextValue {
  readonly locale: Locale
  readonly setLocale: (locale: Locale) => void
  /** Messages in `locale`. */
  readonly t: Translate
}

/** Null outside `<I18nProvider>`: text renders in English there (isolated component tests). */
export const I18nContext = createContext<I18nContextValue | null>(null)
