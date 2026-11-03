import type { Locale } from './locale'
import { en } from './messages/en'
import { es } from './messages/es'
import type { Messages } from './translate'

/** Every dictionary, by locale. */
export const LOCALE_MESSAGES: Readonly<Record<Locale, Messages>> = { en, es }
