import type { AnyNodeDefinition } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import { createDefaultRegistry } from './index'

/** Formulas are display strings for a node header: anything longer stops reading as a subtitle. */
const MAX_FORMULA_LENGTH = 40

const definitions = createDefaultRegistry().list()

const hasGenericPort = (definition: AnyNodeDefinition): boolean =>
  [...definition.inputs, ...definition.outputs].some((port) => port.type.kind === 'generic')

const portsOf = (definition: AnyNodeDefinition) => [
  ...definition.inputs.map((port) => ({ side: 'input', ...port })),
  ...definition.outputs.map((port) => ({ side: 'output', ...port })),
]

describe('built-in node explanations', () => {
  it('gives every node with generic ports a formula', () => {
    const missing = definitions
      .filter((definition) => hasGenericPort(definition))
      .filter((definition) => (definition.formula ?? '').trim() === '')
      .map((definition) => definition.type)

    expect(missing).toEqual([])
  })

  it('keeps every formula a short single line', () => {
    for (const definition of definitions) {
      if (definition.formula === undefined) continue
      expect(definition.formula, definition.type).not.toMatch(/\n/)
      expect(definition.formula.length, definition.type).toBeLessThanOrEqual(MAX_FORMULA_LENGTH)
    }
  })

  it('describes every port of every built-in node', () => {
    const missing = definitions.flatMap((definition) =>
      portsOf(definition)
        .filter((port) => (port.description ?? '').trim() === '')
        .map((port) => `${definition.type} ${port.side} ${port.id}`),
    )

    expect(missing).toEqual([])
  })

  it('writes node and port descriptions as sentences', () => {
    for (const definition of definitions) {
      expect(definition.description, definition.type).toMatch(/^[A-Z].*\.$/)
      for (const port of portsOf(definition)) {
        expect(port.description, `${definition.type} ${port.id}`).toMatch(/^[A-Z0-9].*\.$/)
      }
    }
  })
})
