import type { AnyNodeDefinition, DataType, ParamValue } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import {
  PHASE_2_CATALOG_A,
  aaStepNode,
  combineNode,
  createDefaultRegistry,
  createRecordingFacade,
  rotate2dNode,
  selectNode,
  splitNode,
} from './index'

const CATALOG_A_TYPES = [
  'math/subtract',
  'math/divide',
  'math/power',
  'math/cos',
  'math/abs',
  'math/fract',
  'math/floor',
  'math/one-minus',
  'math/exp',
  'math/min',
  'math/max',
  'math/clamp',
  'math/remap',
  'math/distance',
  'interpolation/step',
  'interpolation/smoothstep',
  'interpolation/aa-step',
  'logic/select',
  'vector/split',
  'vector/combine',
  'vector/dot',
  'vector/length',
  'vector/normalize',
  'vector/rotate-2d',
]

interface BuildCase {
  readonly type: string
  readonly inputs: Readonly<Record<string, string>>
  readonly expected: Readonly<Record<string, string>>
}

const SIMPLE_BUILD_CASES: readonly BuildCase[] = [
  { type: 'math/subtract', inputs: { a: 'a', b: 'b' }, expected: { out: 'sub(a,b)' } },
  { type: 'math/divide', inputs: { a: 'a', b: 'b' }, expected: { out: 'div(a,b)' } },
  { type: 'math/power', inputs: { a: 'a', b: 'b' }, expected: { out: 'pow(a,b)' } },
  { type: 'math/cos', inputs: { in: 'x' }, expected: { out: 'cos(x)' } },
  { type: 'math/abs', inputs: { in: 'x' }, expected: { out: 'abs(x)' } },
  { type: 'math/fract', inputs: { in: 'x' }, expected: { out: 'fract(x)' } },
  { type: 'math/floor', inputs: { in: 'x' }, expected: { out: 'floor(x)' } },
  { type: 'math/one-minus', inputs: { in: 'x' }, expected: { out: 'oneMinus(x)' } },
  { type: 'math/exp', inputs: { in: 'x' }, expected: { out: 'exp(x)' } },
  { type: 'math/min', inputs: { a: 'a', b: 'b' }, expected: { out: 'min(a,b)' } },
  { type: 'math/max', inputs: { a: 'a', b: 'b' }, expected: { out: 'max(a,b)' } },
  {
    type: 'math/clamp',
    inputs: { in: 'x', min: 'lo', max: 'hi' },
    expected: { out: 'clamp(x,lo,hi)' },
  },
  {
    type: 'math/remap',
    inputs: { in: 'x', inMin: 'a', inMax: 'b', outMin: 'c', outMax: 'd' },
    expected: { out: 'remap(x,a,b,c,d)' },
  },
  { type: 'math/distance', inputs: { a: 'a', b: 'b' }, expected: { out: 'distance(a,b)' } },
  {
    type: 'interpolation/step',
    inputs: { edge: 'e', in: 'x' },
    expected: { out: 'step(e,x)' },
  },
  {
    type: 'interpolation/smoothstep',
    inputs: { edge0: 'e0', edge1: 'e1', in: 'x' },
    expected: { out: 'smoothstep(e0,e1,x)' },
  },
  { type: 'vector/dot', inputs: { a: 'a', b: 'b' }, expected: { out: 'dot(a,b)' } },
  { type: 'vector/length', inputs: { in: 'v' }, expected: { out: 'length(v)' } },
  { type: 'vector/normalize', inputs: { in: 'v' }, expected: { out: 'normalize(v)' } },
]

const findDefinition = (type: string): AnyNodeDefinition => {
  const definition = PHASE_2_CATALOG_A.find((candidate) => candidate.type === type)
  if (!definition) throw new Error(`Missing catalog-A definition: ${type}`)
  return definition
}

const buildWith = (
  definition: AnyNodeDefinition,
  inputs: Readonly<Record<string, string>>,
  resolvedTypes: Readonly<Record<string, DataType>> = {},
  params: Readonly<Record<string, ParamValue>> = {},
): Readonly<Record<string, string>> =>
  definition.build({ tsl: createRecordingFacade(), inputs, resolvedTypes, params, property: null })

describe('catalog A registration', () => {
  it('registry contains every catalog-A type', () => {
    const registered = new Set(
      createDefaultRegistry()
        .list()
        .map((definition) => definition.type),
    )

    for (const type of CATALOG_A_TYPES) {
      expect(registered.has(type), type).toBe(true)
    }
    expect(PHASE_2_CATALOG_A.map((definition) => definition.type)).toEqual(CATALOG_A_TYPES)
  })

  it('every definition has description, keywords and unique type', () => {
    const definitions = createDefaultRegistry().list()
    const types = definitions.map((definition) => definition.type)

    expect(new Set(types).size).toBe(types.length)
    for (const definition of definitions) {
      expect(definition.description.trim(), definition.type).not.toBe('')
      expect(definition.keywords.length, definition.type).toBeGreaterThan(0)
    }
  })
})

describe('catalog A builds', () => {
  it.each(SIMPLE_BUILD_CASES)('$type builds $expected', ({ type, inputs, expected }) => {
    expect(buildWith(findDefinition(type), inputs)).toEqual(expected)
  })

  it("aa-step builds lettra's formula", () => {
    const { out } = buildWith(aaStepNode, { edge: 'e', in: 'x' })

    expect(out).toBe(
      'smoothstep(sub(e,mul(max(fwidth(x),construct(float,[0.0001])),construct(float,[0.75]))),' +
        'add(e,mul(max(fwidth(x),construct(float,[0.0001])),construct(float,[0.75]))),x)',
    )
  })

  it('split of a vec2 gives zero z/w', () => {
    const outputs = buildWith(splitNode, { in: 'v' }, { in: 'vec2' })

    expect(outputs).toEqual({
      x: 'swizzle(v,x)',
      y: 'swizzle(v,y)',
      z: 'construct(float,[0])',
      w: 'construct(float,[0])',
    })
  })

  it('split of a vec3 keeps z and zeroes w', () => {
    const outputs = buildWith(splitNode, { in: 'v' }, { in: 'vec3' })

    expect(outputs.z).toBe('swizzle(v,z)')
    expect(outputs.w).toBe('construct(float,[0])')
  })

  it('split of a vec4 exposes every component', () => {
    const outputs = buildWith(splitNode, { in: 'v' }, { in: 'vec4' })

    expect(outputs.z).toBe('swizzle(v,z)')
    expect(outputs.w).toBe('swizzle(v,w)')
  })

  it('combine builds vec2, vec3 and vec4 from the components', () => {
    expect(buildWith(combineNode, { x: 'x', y: 'y', z: 'z', w: 'w' })).toEqual({
      vec2: 'construct(vec2,[x,y])',
      vec3: 'construct(vec3,[x,y,z])',
      vec4: 'construct(vec4,[x,y,z,w])',
    })
  })

  it('select prints op', () => {
    const inputs = { a: 'a', b: 'b', whenTrue: 't', whenFalse: 'f' }

    expect(buildWith(selectNode, inputs, {}, { op: 'gte' }).out).toBe('select(gte,a,b,t,f)')
  })

  it('select falls back to lt when the op param is missing or unknown', () => {
    const inputs = { a: 'a', b: 'b', whenTrue: 't', whenFalse: 'f' }

    expect(buildWith(selectNode, inputs).out).toBe('select(lt,a,b,t,f)')
    expect(buildWith(selectNode, inputs, {}, { op: 'nope' }).out).toBe('select(lt,a,b,t,f)')
  })

  it('select declares the comparison operators with symbolic labels', () => {
    const op = selectNode.params?.find((param) => param.id === 'op')

    expect(op?.kind).toBe('enum')
    if (op?.kind !== 'enum') return
    expect(op.default).toBe('lt')
    expect(op.options.map((option) => [option.value, option.label])).toEqual([
      ['lt', '<'],
      ['lte', '≤'],
      ['gt', '>'],
      ['gte', '≥'],
      ['eq', '='],
    ])
  })

  it('rotate-2d builds around center', () => {
    const { out } = buildWith(rotate2dNode, { in: 'p', angle: 'a', center: 'c' })

    const offset = 'sub(p,c)'
    const x = `swizzle(${offset},x)`
    const y = `swizzle(${offset},y)`
    const rotatedX = `sub(mul(${x},cos(a)),mul(${y},sin(a)))`
    const rotatedY = `add(mul(${x},sin(a)),mul(${y},cos(a)))`
    expect(out).toBe(`add(construct(vec2,[${rotatedX},${rotatedY}]),c)`)
  })
})
