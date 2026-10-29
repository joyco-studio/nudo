import type {
  BuiltinName,
  CompareOp,
  NoiseKind,
  Swizzle,
  TslFacade,
  VoronoiMetric,
} from '@nudo-tsl/core'
import { ConditionalNode, Node, OperatorNode, SplitNode, TextureNode, VarNode } from 'three/webgpu'
import { texture } from 'three/tsl'
import { DataTexture } from 'three'
import { describe, expect, it } from 'vitest'
import { createLiveFacade } from './live-facade'
import type { LiveNode } from './live-facade'

const BUILTIN_NAMES = [
  'time',
  'deltaTime',
  'uv',
  'normalWorld',
  'normalView',
  'positionLocal',
  'positionWorld',
  'positionViewDirection',
  'positionView',
  'screenUV',
  'cameraPosition',
] as const satisfies readonly BuiltinName[]

const COMPARE_OPS = ['lt', 'lte', 'gt', 'gte', 'eq'] as const satisfies readonly CompareOp[]

const NOISE_KINDS = ['perlin', 'simplex'] as const satisfies readonly NoiseKind[]

const VORONOI_METRICS = [
  'euclidean',
  'manhattan',
  'chebyshev',
] as const satisfies readonly VoronoiMetric[]

const SWIZZLES = ['x', 'y', 'z', 'w', 'xy', 'xyz'] as const satisfies readonly Swizzle[]

interface Operands {
  readonly a: LiveNode
  readonly b: LiveNode
  readonly c: LiveNode
  readonly d: LiveNode
  readonly e: LiveNode
  readonly vec2: LiveNode
  readonly vec3: LiveNode
  readonly textureNode: LiveNode
}

const createOperands = (tsl: TslFacade<LiveNode>): Operands => ({
  a: tsl.construct('float', [0.25]),
  b: tsl.construct('float', [2]),
  c: tsl.construct('float', [0.5]),
  d: tsl.construct('float', [3]),
  e: tsl.construct('float', [4]),
  vec2: tsl.construct('vec2', [0.3, 0.7]),
  vec3: tsl.construct('vec3', [0.1, 0.2, 0.3]),
  textureNode: texture(new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)),
})

type ExpressionFactory = (tsl: TslFacade<LiveNode>, operands: Operands) => LiveNode

const FACADE_OPERATIONS: readonly (readonly [string, ExpressionFactory])[] = [
  ['add', (tsl, { a, b }) => tsl.add(a, b)],
  ['sub', (tsl, { a, b }) => tsl.sub(a, b)],
  ['mul', (tsl, { a, b }) => tsl.mul(a, b)],
  ['div', (tsl, { a, b }) => tsl.div(a, b)],
  ['sin', (tsl, { a }) => tsl.sin(a)],
  ['cos', (tsl, { a }) => tsl.cos(a)],
  ['abs', (tsl, { a }) => tsl.abs(a)],
  ['fract', (tsl, { a }) => tsl.fract(a)],
  ['floor', (tsl, { a }) => tsl.floor(a)],
  ['min', (tsl, { a, b }) => tsl.min(a, b)],
  ['max', (tsl, { a, b }) => tsl.max(a, b)],
  ['exp', (tsl, { a }) => tsl.exp(a)],
  ['pow', (tsl, { a, b }) => tsl.pow(a, b)],
  ['oneMinus', (tsl, { a }) => tsl.oneMinus(a)],
  ['clamp', (tsl, { a, b, c }) => tsl.clamp(a, c, b)],
  ['dot', (tsl, { vec3 }) => tsl.dot(vec3, vec3)],
  ['length', (tsl, { vec3 }) => tsl.length(vec3)],
  ['normalize', (tsl, { vec3 }) => tsl.normalize(vec3)],
  ['distance', (tsl, { vec3 }) => tsl.distance(vec3, tsl.builtin('positionLocal'))],
  ['mix', (tsl, { a, b, c }) => tsl.mix(a, b, c)],
  ['step', (tsl, { a, b }) => tsl.step(a, b)],
  ['smoothstep', (tsl, { a, b, c }) => tsl.smoothstep(a, b, c)],
  ['fwidth', (tsl, { a }) => tsl.fwidth(a)],
  ['remap', (tsl, { a, b, c, d, e }) => tsl.remap(a, b, c, d, e)],
  ['cellNoise', (tsl, { vec3 }) => tsl.cellNoise(vec3)],
  ['checker', (tsl, { vec2 }) => tsl.checker(vec2)],
  [
    'textureSample (auto mip)',
    (tsl, { textureNode, vec2 }) => tsl.textureSample(textureNode, vec2, null),
  ],
  [
    'textureSample (level)',
    (tsl, { textureNode, vec2, a }) => tsl.textureSample(textureNode, vec2, a),
  ],
  ['colorSpace srgb-to-linear', (tsl, { vec3 }) => tsl.colorSpace('srgb-to-linear', vec3)],
  ['colorSpace linear-to-srgb', (tsl, { vec3 }) => tsl.colorSpace('linear-to-srgb', vec3)],
  ['sceneColor', (tsl, { vec2 }) => tsl.sceneColor(vec2)],
  ['sceneDepthFade', (tsl, { b }) => tsl.sceneDepthFade(b)],
  ['normalFromHeight', (tsl, { a, b }) => tsl.normalFromHeight(a, b)],
  ['construct float', (tsl) => tsl.construct('float', [1])],
  ['construct vec2', (tsl) => tsl.construct('vec2', [1, 2])],
  ['construct vec3', (tsl, { vec2 }) => tsl.construct('vec3', [vec2, 3])],
  ['construct vec4', (tsl, { vec3 }) => tsl.construct('vec4', [vec3, 1])],
  ...COMPARE_OPS.map((op): readonly [string, ExpressionFactory] => [
    `select ${op}`,
    (tsl, { a, b, vec3 }) => tsl.select(op, a, b, vec3, tsl.construct('vec3', [0])),
  ]),
  ...NOISE_KINDS.map((kind): readonly [string, ExpressionFactory] => [
    `noise ${kind}`,
    (tsl, { vec3 }) => tsl.noise(kind, vec3),
  ]),
  ...VORONOI_METRICS.flatMap((metric): readonly (readonly [string, ExpressionFactory])[] => [
    [`voronoi ${metric}`, (tsl, { vec2, a }) => tsl.voronoi(vec2, a, metric)],
    [`voronoiCell 2 ${metric}`, (tsl, { vec2, a }) => tsl.voronoiCell(2, vec2, a, metric)],
    [`voronoiCell 3 ${metric}`, (tsl, { vec3, a }) => tsl.voronoiCell(3, vec3, a, metric)],
  ]),
  ...SWIZZLES.map((components): readonly [string, ExpressionFactory] => [
    `swizzle ${components}`,
    (tsl) => tsl.swizzle(tsl.construct('vec4', [1, 2, 3, 4]), components),
  ]),
]

/** TSL wraps constructed values in a VarNode; this reaches the expression inside it. */
function unwrapVar(node: unknown): unknown {
  return node instanceof VarNode ? Reflect.get(node, 'node') : node
}

const COMPARISON_OPERATORS = {
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
  eq: '==',
} as const satisfies Record<CompareOp, string>

describe('createLiveFacade', () => {
  const tsl = createLiveFacade()
  const operands = createOperands(tsl)

  it.each(BUILTIN_NAMES)('resolves the %s builtin to a node', (name) => {
    expect(tsl.builtin(name)).toBeInstanceOf(Node)
  })

  it.each(FACADE_OPERATIONS)('%s returns a node', (_name, createExpression) => {
    expect(createExpression(tsl, operands)).toBeInstanceOf(Node)
  })

  it('constructs vectors from numbers and nodes', () => {
    const xy = tsl.construct('vec2', [1, 2])
    const xyz = tsl.construct('vec3', [xy, 3])
    const xyzw = tsl.construct('vec4', [xyz, 1])

    expect(xyzw).toBeInstanceOf(Node)
  })

  it('samples a texture node with an explicit mip level', () => {
    const sampled = tsl.textureSample(operands.textureNode, operands.vec2, operands.a)

    expect(sampled).toBeInstanceOf(TextureNode)
    expect(Reflect.get(sampled, 'levelNode')).toBe(operands.a)
  })

  it('leaves the mip level automatic when none is given', () => {
    const sampled = tsl.textureSample(operands.textureNode, operands.vec2, null)

    expect(Reflect.get(sampled, 'levelNode')).toBeNull()
  })

  it('refuses to sample something that is not a texture node', () => {
    expect(() => tsl.textureSample(operands.a, operands.vec2, null)).toThrow(/texture/i)
  })

  it.each(COMPARE_OPS)('select %s compares with the matching operator', (op) => {
    const { a, b, vec3 } = operands

    const selected = tsl.select(op, a, b, vec3, vec3)

    expect(selected).toBeInstanceOf(ConditionalNode)
    const condition = unwrapVar(Reflect.get(selected, 'condNode'))
    if (!(condition instanceof OperatorNode)) throw new Error('Expected a comparison node')
    expect(Reflect.get(condition, 'op')).toBe(COMPARISON_OPERATORS[op])
  })

  it.each(SWIZZLES)('swizzle %s reads exactly those components', (components) => {
    const swizzled = tsl.swizzle(tsl.construct('vec4', [1, 2, 3, 4]), components)

    expect(swizzled).toBeInstanceOf(SplitNode)
    expect(Reflect.get(swizzled, 'components')).toBe(components)
  })
})
