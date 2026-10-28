import { use } from 'react'

import { I18nContext } from './i18n-context'
import type { Locale } from './locale'
import { translateEnglish } from './translate'
import type { Translate } from './translate'

/** `t(key, params?)`: a message in the current locale, with its `{name}` placeholders filled. */
export function useT(): Translate {
  return use(I18nContext)?.t ?? translateEnglish
}

export interface LocaleState {
  readonly locale: Locale
  readonly setLocale: (locale: Locale) => void
}

/** The current locale and its switch (the header menu, the command palette). */
export function useLocale(): LocaleState {
  const context = use(I18nContext)
  if (context === null) throw new Error('useLocale must be used inside <I18nProvider>.')
  return context
}

/** The current locale, or English outside the provider. */
export function useCurrentLocale(): Locale {
  return use(I18nContext)?.locale ?? 'en'
}
