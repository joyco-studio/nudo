import type { BuiltinName } from '@nudo-tsl/core'

import type { MessageKey } from '@/i18n/translate'

/** What an unconnected input with a builtin fallback reads from, shown instead of a value field. */
export const fallbackLabel = (fallback: BuiltinName): MessageKey => `fallback.${fallback}`
