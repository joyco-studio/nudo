import type { BuiltinName, Swizzle, TslFacade, VectorType } from '@nudo-tsl/core'
import { Node } from 'three/webgpu'
import {
  add,
  clamp,
  dot,
  float,
  mix,
  mul,
  normalView,
  normalWorld,
  oneMinus,
  positionLocal,
  positionViewDirection,
  positionWorld,
  pow,
  sin,
  time,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

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
const mulNodes = widen(mul)
const powNodes = widen(pow)
const dotNodes = widen(dot)
const sinNode = widen(sin)
const oneMinusNode = widen(oneMinus)
const clampNodes = widen(clamp)
const mixNodes = widen(mix)

const CONSTRUCTORS: Readonly<Record<VectorType, TslFunction>> = {
  float: widen(float),
  vec2: widen(vec2),
  vec3: widen(vec3),
  vec4: widen(vec4),
}

/** Placeholder for facade members that Phase 2 Task 5 implements. */
const notImplemented = (name: string): never => {
  throw new Error(`not implemented: ${name}`)
}

const BUILTINS: Readonly<Record<BuiltinName, () => LiveNode>> = {
  time: () => time,
  uv: () => uv(),
  normalWorld: () => normalWorld,
  normalView: () => normalView,
  positionLocal: () => positionLocal,
  positionWorld: () => positionWorld,
  positionViewDirection: () => positionViewDirection,
  positionView: () => notImplemented('builtin positionView'),
  screenUV: () => notImplemented('builtin screenUV'),
  cameraPosition: () => notImplemented('builtin cameraPosition'),
}

const isLiveNode = (candidate: unknown): candidate is LiveNode => candidate instanceof Node

/** Reads `.x`, `.xy` or `.xyz` off a node; TSL exposes swizzles as dynamic properties. */
function readSwizzle(value: LiveNode, components: Swizzle): LiveNode {
  const swizzled: unknown = Reflect.get(value, components)
  if (!isLiveNode(swizzled)) throw new Error(`Cannot swizzle .${components} from this node`)
  return swizzled
}

export function createLiveFacade(): TslFacade<LiveNode> {
  return {
    add: (a, b) => addNodes(a, b),
    sub: () => notImplemented('sub'),
    mul: (a, b) => mulNodes(a, b),
    div: () => notImplemented('div'),
    sin: (a) => sinNode(a),
    cos: () => notImplemented('cos'),
    abs: () => notImplemented('abs'),
    fract: () => notImplemented('fract'),
    floor: () => notImplemented('floor'),
    min: () => notImplemented('min'),
    max: () => notImplemented('max'),
    exp: () => notImplemented('exp'),
    pow: (a, b) => powNodes(a, b),
    oneMinus: (a) => oneMinusNode(a),
    clamp: (x, low, high) => clampNodes(x, low, high),
    dot: (a, b) => dotNodes(a, b),
    length: () => notImplemented('length'),
    normalize: () => notImplemented('normalize'),
    distance: () => notImplemented('distance'),
    mix: (a, b, t) => mixNodes(a, b, t),
    step: () => notImplemented('step'),
    smoothstep: () => notImplemented('smoothstep'),
    fwidth: () => notImplemented('fwidth'),
    remap: () => notImplemented('remap'),
    select: () => notImplemented('select'),
    noise: () => notImplemented('noise'),
    voronoi: () => notImplemented('voronoi'),
    checker: () => notImplemented('checker'),
    textureSample: () => notImplemented('textureSample'),
    colorSpace: () => notImplemented('colorSpace'),
    builtin: (name) => BUILTINS[name](),
    construct: (type, parts) => CONSTRUCTORS[type](...parts),
    swizzle: readSwizzle,
  }
}
