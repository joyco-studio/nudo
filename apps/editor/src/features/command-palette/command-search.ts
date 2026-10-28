import { translateEnglish } from '@/i18n/translate'
import type { Translate } from '@/i18n/translate'

import type { Command } from './command-registry'
import { commandSearchText } from './command-text'

/** Anything but letters, digits and `?` separates words ("layout:", "Ctrl/⌘"). */
const WORD_SEPARATOR = /[^\p{L}\p{N}?]+/u

/** The lowercase words of a text or a search query. */
export function wordsOf(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(WORD_SEPARATOR)
    .filter((word) => word !== '')
}

/**
 * Whether every query word starts a word of `text`, in any order: "spl" finds "Split", but "si"
 * doesn't find "Position". Command names are phrases, so a match in the middle of a word is
 * almost always noise.
 */
export function startsWordsFor(text: string, queryWords: readonly string[]): boolean {
  const textWords = wordsOf(text)
  return queryWords.every((queryWord) =>
    textWords.some((textWord) => textWord.startsWith(queryWord)),
  )
}

/**
 * Case-insensitive search over names and keywords, in the UI language and in English (see
 * `startsWordsFor`). Keeps registry order; an empty query keeps every command.
 */
export function searchCommands(
  commands: readonly Command[],
  query: string,
  t: Translate = translateEnglish,
): readonly Command[] {
  const queryWords = wordsOf(query)
  return commands.filter((command) => startsWordsFor(commandSearchText(command, t), queryWords))
}
