// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SOURCE_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Attributes whose text a person reads or hears. */
const VISIBLE_ATTRIBUTES: ReadonlySet<string> = new Set([
  'aria-label',
  'aria-valuetext',
  'aria-roledescription',
  'title',
  'placeholder',
  'alt',
  'label',
  'heading',
  'description',
  'regionLabel',
  'accessibleName',
  'ariaLabel',
  'visibleLabel',
])

/**
 * Text that is the same in every language: the wordmark, key caps printed on the keyboard, and
 * symbols. Anything else in JSX must come from the messages.
 */
const LANGUAGE_NEUTRAL: ReadonlySet<string> = new Set(['Nudo', 'Del', '+', '→', ','])

/** A string has words in it when it holds two letters in a row. */
const HAS_WORDS = /\p{L}{2}/u

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    const isComponent = entry.name.endsWith('.tsx') && !entry.name.includes('.test.')
    return isComponent ? [path] : []
  })
}

function isUserText(text: string): boolean {
  const trimmed = text.trim()
  return HAS_WORDS.test(trimmed) && !LANGUAGE_NEUTRAL.has(trimmed)
}

/** JSX text and visible attributes written as literals, as "file:line text". */
function hardcodedStrings(path: string): readonly string[] {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const report = (node: ts.Node, text: string): void => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart())
    found.push(`${relative(SOURCE_ROOT, path)}:${String(line + 1)} ${text.trim()}`)
  }
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node) && isUserText(node.text)) report(node, node.text)
    if (ts.isJsxAttribute(node) && VISIBLE_ATTRIBUTES.has(node.name.getText(source))) {
      const value = node.initializer
      const literal = value !== undefined && ts.isJsxExpression(value) ? value.expression : value
      if (
        literal !== undefined &&
        (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal)) &&
        isUserText(literal.text)
      ) {
        report(node, literal.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('UI copy', () => {
  it('keeps no user-visible string hardcoded in JSX: every one comes from the messages', () => {
    const found = sourceFiles(SOURCE_ROOT).flatMap(hardcodedStrings)
    expect(found).toEqual([])
  })
})
