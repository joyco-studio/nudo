import { parse } from 'sugar-high/core'
import type { TokenType } from 'sugar-high/core'
import { tokenize } from 'sugar-high/lang/javascript'

/** What a piece of source is, as sugar-high's JavaScript lexer reads it. */
export type CodeTokenKind = TokenType

export interface CodeToken {
  readonly kind: CodeTokenKind
  readonly text: string
}

/** One source line, its tokens in order; an empty line has none. */
export type CodeLine = readonly CodeToken[]

/** Splits a module into lines of highlighted tokens. Joining them back with `\n` gives `code`. */
export function highlightCode(code: string): readonly CodeLine[] {
  const parsed = parse(code, { tokenize: (source) => tokenize(source, undefined) })
  return parsed.lines.map((line) =>
    line.tokens
      .filter((token) => token.value !== '')
      .map((token) => ({ kind: token.type, text: token.value })),
  )
}
