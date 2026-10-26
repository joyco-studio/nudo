import { describe, expect, expectTypeOf, it } from 'vitest'
import { concrete, float } from '../values/port-value-factories'
import { defineNode } from './define-node'
import { createNodeRegistry } from './node-registry'

const createPassThroughNode = (type: string) =>
  defineNode({
    type,
    category: 'utility',
    label: type,
    description: `Pass-through node ${type}`,
    keywords: [],
    inputs: [{ id: 'a', label: 'A', type: concrete('float'), default: float(0) }],
    outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
    build: ({ inputs }) => ({ out: inputs.a }),
  })

describe('node registry', () => {
  it('register then get returns the definition', () => {
    const registry = createNodeRegistry()
    const definition = createPassThroughNode('utility/pass')

    const result = registry.register(definition)

    expect(result.ok).toBe(true)
    expect(registry.get('utility/pass')).toBe(definition)
  })

  it('get returns undefined for an unknown type', () => {
    expect(createNodeRegistry().get('utility/missing')).toBeUndefined()
  })

  it('register rejects duplicate type with code duplicate-type', () => {
    const registry = createNodeRegistry()
    const first = createPassThroughNode('utility/pass')
    registry.register(first)

    const result = registry.register(createPassThroughNode('utility/pass'))

    expect(result).toEqual({ ok: false, error: { code: 'duplicate-type', type: 'utility/pass' } })
    expect(registry.get('utility/pass')).toBe(first)
  })

  it('list preserves insertion order', () => {
    const registry = createNodeRegistry()
    const definitions = ['utility/c', 'utility/a', 'utility/b'].map(createPassThroughNode)
    definitions.forEach((definition) => registry.register(definition))

    expect(registry.list()).toEqual(definitions)
  })
})

describe('defineNode typing', () => {
  it('exposes declared input ids to build and rejects unknown ones', () => {
    defineNode({
      type: 'utility/typed',
      category: 'utility',
      label: 'Typed',
      description: 'Type-level check',
      keywords: [],
      inputs: [{ id: 'a', label: 'A', type: concrete('float'), default: float(0) }],
      outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
      build: ({ inputs }) => {
        expectTypeOf<keyof typeof inputs>().toEqualTypeOf<'a'>()
        expectTypeOf(inputs).not.toHaveProperty('zzz')
        return { out: inputs.a }
      },
    })
  })
})
