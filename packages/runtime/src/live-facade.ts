import { WORLEY_METRIC_IDS } from '@nudo-tsl/core'
import type {
  BuiltinName,
  CellDimensions,
  ColorSpaceDirection,
  CompareOp,
  NoiseKind,
  Swizzle,
  TslFacade,
  VectorType,
  VoronoiMetric,
} from '@nudo-tsl/core'
import { Node, TextureNode } from 'three/webgpu'
import {
  abs,
  add,
  cameraPosition,
  checker,
  clamp,
  cos,
  deltaTime,
  distance,
  div,
  dot,
  equal,
  exp,
  float,
  floor,
  fract,
  fwidth,
  greaterThan,
  greaterThanEqual,
  length,
  lessThan,
  lessThanEqual,
  max,
  min,
  mix,
  mul,
  mx_cell_noise_float,
  mx_noise_float,
  mx_worley_noise_vec2,
  mx_worley_noise_vec3,
  normalView,
  normalWorld,
  normalize,
  oneMinus,
  positionLocal,
  positionView,
  positionViewDirection,
  positionWorld,
  pow,
  remap,
  sRGBTransferEOTF,
  sRGBTransferOETF,
  screenUV,
  select,
  sin,
  smoothstep,
  step,
  sub,
  time,
  uv,
  vec2,
  vec3,
  vec4,
  viewportSharedTexture,
} from 'three/tsl'
import { normalFromHeight } from './normal-from-height'
import { sceneDepthFade } from './scene-depth-fade'
import { simplexNoise3 } from './simplex-noise'
import { voronoiCell2, voronoiCell3 } from './voronoi-cell'

export type LiveNode = Node

type NodeOrNumber = LiveNode | number
type TslFunction = (...args: readonly NodeOrNumber[]) => LiveNode

/**
 * @types/three overloads every TSL function once per concrete node type (`Node<'vec3'>`, ...),
 * so a type-erased `Node` matches none of them. Graph types are only known at runtime, hence the
 * single widening point below: every TSL function enters the facade through here.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- widening overloaded TSL functions to a type-erased signature is impossible without an assertion
const widen = (tslFunction: unknown): TslFunction => tslFunction as TslFunction

const addNodes = widen(add)
const subNodes = widen(sub)
const mulNodes = widen(mul)
const divNodes = widen(div)
const sinNode = widen(sin)
const cosNode = widen(cos)
const absNode = widen(abs)
const fractNode = widen(fract)
const floorNode = widen(floor)
const minNodes = widen(min)
const maxNodes = widen(max)
const expNode = widen(exp)
const powNodes = widen(pow)
const oneMinusNode = widen(oneMinus)
const clampNodes = widen(clamp)
const dotNodes = widen(dot)
const lengthNode = widen(length)
const normalizeNode = widen(normalize)
const distanceNodes = widen(distance)
const mixNodes = widen(mix)
const stepNodes = widen(step)
const smoothstepNodes = widen(smoothstep)
const fwidthNode = widen(fwidth)
const remapNodes = widen(remap)
const selectNodes = widen(select)
const perlinNoiseNode = widen(mx_noise_float)
const simplexNoiseNode = widen(simplexNoise3)
const worleyNoiseVec2Nodes = widen(mx_worley_noise_vec2)
const worleyNoiseVec3Nodes = widen(mx_worley_noise_vec3)
const cellNoiseNode = widen(mx_cell_noise_float)
const checkerNode = widen(checker)
const srgbToLinearNode = widen(sRGBTransferEOTF)
const linearToSrgbNode = widen(sRGBTransferOETF)
const sceneColorNode = widen(viewportSharedTexture)
const sceneDepthFadeNode = widen(sceneDepthFade)
const normalFromHeightNodes = widen(normalFromHeight)

const COMPARISONS: Readonly<Record<CompareOp, TslFunction>> = {
  lt: widen(lessThan),
  lte: widen(lessThanEqual),
  gt: widen(greaterThan),
  gte: widen(greaterThanEqual),
  eq: widen(equal),
}

const NOISES: Readonly<Record<NoiseKind, TslFunction>> = {
  perlin: perlinNoiseNode,
  simplex: simplexNoiseNode,
}

const CELL_SEARCHES: Readonly<Record<CellDimensions, TslFunction>> = {
  2: widen(voronoiCell2),
  3: widen(voronoiCell3),
}

const COLOR_SPACE_CONVERSIONS: Readonly<Record<ColorSpaceDirection, TslFunction>> = {
  'srgb-to-linear': srgbToLinearNode,
  'linear-to-srgb': linearToSrgbNode,
}

const CONSTRUCTORS: Readonly<Record<VectorType, TslFunction>> = {
  float: widen(float),
  vec2: widen(vec2),
  vec3: widen(vec3),
  vec4: widen(vec4),
}

const BUILTINS: Readonly<Record<BuiltinName, () => LiveNode>> = {
  time: () => time,
  deltaTime: () => deltaTime,
  uv: () => uv(),
  normalWorld: () => normalWorld,
  normalView: () => normalView,
  positionLocal: () => positionLocal,
  positionWorld: () => positionWorld,
  positionViewDirection: () => positionViewDirection,
  positionView: () => positionView,
  screenUV: () => screenUV,
  cameraPosition: () => cameraPosition,
}

const isLiveNode = (candidate: unknown): candidate is LiveNode => candidate instanceof Node

/** Reads a swizzle off a node; TSL exposes swizzles as dynamic properties. */
function readSwizzle(value: LiveNode, components: Swizzle): LiveNode {
  const swizzled: unknown = Reflect.get(value, components)
  if (!isLiveNode(swizzled)) throw new Error(`Cannot swizzle .${components} from this node`)
  return swizzled
}

/**
 * F1 and F2 under `metric`. Euclidean keeps the call it has always made, so old graphs build the
 * same shader; the other metrics read the first two of MaterialX's three nearest distances.
 */
function worleyDistances(p: LiveNode, jitter: LiveNode, metric: VoronoiMetric): LiveNode {
  if (metric === 'euclidean') return worleyNoiseVec2Nodes(p, jitter)
  return readSwizzle(worleyNoiseVec3Nodes(p, jitter, WORLEY_METRIC_IDS[metric]), 'xy')
}

/** `texture.sample(uv)`, with an explicit mip level when one is given. */
function sampleTexture(textureNode: LiveNode, uvNode: LiveNode, level: LiveNode | null): LiveNode {
  if (!(textureNode instanceof TextureNode)) {
    throw new Error('Cannot sample: the input is not a texture')
  }
  const sampled = textureNode.sample(uvNode)
  return level === null ? sampled : sampled.level(level)
}

export function createLiveFacade(): TslFacade<LiveNode> {
  return {
    add: (a, b) => addNodes(a, b),
    sub: (a, b) => subNodes(a, b),
    mul: (a, b) => mulNodes(a, b),
    div: (a, b) => divNodes(a, b),
    sin: (a) => sinNode(a),
    cos: (a) => cosNode(a),
    abs: (a) => absNode(a),
    fract: (a) => fractNode(a),
    floor: (a) => floorNode(a),
    min: (a, b) => minNodes(a, b),
    max: (a, b) => maxNodes(a, b),
    exp: (a) => expNode(a),
    pow: (a, b) => powNodes(a, b),
    oneMinus: (a) => oneMinusNode(a),
    clamp: (x, low, high) => clampNodes(x, low, high),
    dot: (a, b) => dotNodes(a, b),
    length: (a) => lengthNode(a),
    normalize: (a) => normalizeNode(a),
    distance: (a, b) => distanceNodes(a, b),
    mix: (a, b, t) => mixNodes(a, b, t),
    step: (edge, x) => stepNodes(edge, x),
    smoothstep: (edge0, edge1, x) => smoothstepNodes(edge0, edge1, x),
    fwidth: (x) => fwidthNode(x),
    remap: (x, inLow, inHigh, outLow, outHigh) => remapNodes(x, inLow, inHigh, outLow, outHigh),
    select: (op, a, b, whenTrue, whenFalse) =>
      selectNodes(COMPARISONS[op](a, b), whenTrue, whenFalse),
    noise: (kind, p) => NOISES[kind](p),
    voronoi: worleyDistances,
    voronoiCell: (dimensions, p, jitter, metric) =>
      CELL_SEARCHES[dimensions](p, jitter, WORLEY_METRIC_IDS[metric]),
    cellNoise: (p) => cellNoiseNode(p),
    checker: (uvNode) => checkerNode(uvNode),
    textureSample: sampleTexture,
    colorSpace: (direction, color) => COLOR_SPACE_CONVERSIONS[direction](color),
    sceneColor: (uvNode) => readSwizzle(sceneColorNode(uvNode), 'xyz'),
    sceneDepthFade: (distanceNode) => sceneDepthFadeNode(distanceNode),
    normalFromHeight: (height, strength) => normalFromHeightNodes(height, strength),
    builtin: (name) => BUILTINS[name](),
    construct: (type, parts) => CONSTRUCTORS[type](...parts),
    swizzle: readSwizzle,
  }
}
