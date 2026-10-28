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
 * Text that is the same in every language: the wordmark and a key cap printed on the keyboard.
 * Anything else in JSX must come from the messages.
 */
const LANGUAGE_NEUTRAL: ReadonlySet<string> = new Set(['Nudo', 'Del'])

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

/**
 * The literal text an expression can render: a string, the fixed parts of a template, both
 * branches of a condition, both sides of a `+` and the fallback of `??` or `||`.
 */
function literalTexts(expression: ts.Expression): readonly string[] {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return [expression.text]
  }
  if (ts.isTemplateExpression(expression)) {
    return [expression.head.text, ...expression.templateSpans.map((span) => span.literal.text)]
  }
  if (ts.isParenthesizedExpression(expression)) return literalTexts(expression.expression)
  if (ts.isConditionalExpression(expression)) {
    return [...literalTexts(expression.whenTrue), ...literalTexts(expression.whenFalse)]
  }
  if (ts.isBinaryExpression(expression)) {
    const operator = expression.operatorToken.kind
    if (operator === ts.SyntaxKind.PlusToken) {
      return [...literalTexts(expression.left), ...literalTexts(expression.right)]
    }
    if (
      operator === ts.SyntaxKind.QuestionQuestionToken ||
      operator === ts.SyntaxKind.BarBarToken
    ) {
      return literalTexts(expression.right)
    }
  }
  return []
}

/** The value of a visible attribute, or the expression of a `{…}` child of an element. */
function renderedExpression(node: ts.Node, source: ts.SourceFile): ts.Expression | undefined {
  if (ts.isJsxAttribute(node)) {
    if (!VISIBLE_ATTRIBUTES.has(node.name.getText(source))) return undefined
    const value = node.initializer
    if (value === undefined) return undefined
    return ts.isJsxExpression(value) ? value.expression : value
  }
  const isChild = ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)
  return ts.isJsxExpression(node) && isChild ? node.expression : undefined
}

/** JSX text and literals in visible attributes and `{…}` children, as "file:line text". */
function hardcodedStrings(path: string): readonly string[] {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const report = (node: ts.Node, text: string): void => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart())
    found.push(`${relative(SOURCE_ROOT, path)}:${String(line + 1)} ${text.trim()}`)
  }
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node) && isUserText(node.text)) report(node, node.text)
    const expression = renderedExpression(node, source)
    if (expression !== undefined) {
      for (const text of literalTexts(expression)) if (isUserText(text)) report(node, text)
    }
    ts.forEachChild(node, visit)
  }
  // From the top-level statements: every node visited then has a parent.
  ts.forEachChild(source, visit)
  return found
}

describe('UI copy', () => {
  it('keeps no user-visible string hardcoded in JSX: every one comes from the messages', () => {
    const found = sourceFiles(SOURCE_ROOT).flatMap(hardcodedStrings)
    expect(found).toEqual([])
  })
})
