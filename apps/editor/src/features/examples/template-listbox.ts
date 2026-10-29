import { foldForSearch } from '@/shared/lib/fold-for-search'

/**
 * The keyboard model of the templates list (an APG single-select listbox where selection follows
 * focus): the arrow keys step, Home and End jump, and typing a title's first letters selects it.
 */

/** The option a navigation key selects, or null when the key is not one the list moves on. */
export function moveSelection(key: string, index: number, count: number): number | null {
  if (count === 0) return null
  const last = count - 1
  switch (key) {
    case 'ArrowDown':
      return Math.min(index + 1, last)
    case 'ArrowUp':
      return Math.max(index - 1, 0)
    case 'Home':
      return 0
    case 'End':
      return last
    default:
      return null
  }
}

/** One letter, typed once or over and over ("sss"), cycles through the titles that start with it. */
const ONE_LETTER_REPEATED = /^(.)\1*$/su

function isOneLetter(query: string): boolean {
  return ONE_LETTER_REPEATED.test(query)
}

/**
 * The option whose title starts with the typed text. The search starts at the current option, so
 * typing more letters of its title keeps it, and wraps around the list. One letter (typed once or
 * again and again) starts after the current option instead, moving to the next title with it.
 */
export function typeaheadIndex(
  titles: readonly string[],
  query: string,
  fromIndex: number,
): number | null {
  if (query === '' || titles.length === 0) return null
  const isCycling = isOneLetter(query)
  const prefix = foldForSearch(isCycling ? query.charAt(0) : query)
  const start = isCycling ? fromIndex + 1 : fromIndex
  for (let step = 0; step < titles.length; step += 1) {
    const index = (start + step) % titles.length
    if (foldForSearch(titles[index] ?? '').startsWith(prefix)) return index
  }
  return null
}

/** What has been typed so far, and when the last key came. */
export interface TypeaheadState {
  readonly query: string
  readonly at: number
}

export const EMPTY_TYPEAHEAD: TypeaheadState = { query: '', at: Number.NEGATIVE_INFINITY }

/** A printable key types; a space only does inside a query (alone, it is a press). */
export function isTypeaheadKey(key: string, state: TypeaheadState): boolean {
  if (key === ' ') return state.query !== ''
  // Named keys ("ArrowDown", "Enter") are words; a printable key is a single character.
  return key.length === 1
}

/** Adds a typed key to the query, or starts a new one after a pause longer than `resetMs`. */
export function nextTypeahead(
  state: TypeaheadState,
  key: string,
  now: number,
  resetMs: number,
): TypeaheadState {
  const query = now - state.at > resetMs ? key : state.query + key
  return { query, at: now }
}
