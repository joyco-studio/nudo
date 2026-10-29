import { concrete, defineNode, float, generic, vec3 } from '@nudo-tsl/core'
import type { TslFacade } from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

const TYPE_GROUP = 'T'

type BlendMode =
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'linear-light'
  | 'color-burn'
  | 'color-dodge'
  | 'darken'
  | 'lighten'
  | 'difference'
  | 'add'
  | 'subtract'

const DEFAULT_MODE: BlendMode = 'multiply'

const MODE_OPTIONS: readonly EnumOption<BlendMode>[] = [
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'linear-light', label: 'Linear Light' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'difference', label: 'Difference' },
  { value: 'add', label: 'Add' },
  { value: 'subtract', label: 'Subtract' },
]

const OVERLAY_THRESHOLD = 0.5
/** Keeps the burn and dodge divisions finite when the denominator reaches 0. */
const DIVISION_GUARD = 0.00001
const TWO = 2

/** One mode's result for base `a` and blend `b`, before the opacity mix. */
type ModeExpression = <E>(tsl: TslFacade<E>, a: E, b: E) => E

const constant = <E>(tsl: TslFacade<E>, value: number): E => tsl.construct('float', [value])

const MODE_EXPRESSIONS: Readonly<Record<BlendMode, ModeExpression>> = {
  multiply: (tsl, a, b) => tsl.mul(a, b),
  // 1 − (1 − a)(1 − b)
  screen: (tsl, a, b) => tsl.oneMinus(tsl.mul(tsl.oneMinus(a), tsl.oneMinus(b))),
  // mix(2ab, 1 − 2(1 − a)(1 − b), step(0.5, a)): the step picks per component, no select needed.
  overlay: (tsl, a, b) => {
    const two = constant(tsl, TWO)
    return tsl.mix(
      tsl.mul(two, tsl.mul(a, b)),
      tsl.oneMinus(tsl.mul(two, tsl.mul(tsl.oneMinus(a), tsl.oneMinus(b)))),
      tsl.step(constant(tsl, OVERLAY_THRESHOLD), a),
    )
  },
  // Pegtop: (1 − 2b)·a² + 2ab
  'soft-light': (tsl, a, b) => {
    const two = constant(tsl, TWO)
    return tsl.add(
      tsl.mul(tsl.sub(constant(tsl, 1), tsl.mul(two, b)), tsl.mul(a, a)),
      tsl.mul(two, tsl.mul(a, b)),
    )
  },
  // a + 2b − 1
  'linear-light': (tsl, a, b) =>
    tsl.sub(tsl.add(a, tsl.mul(constant(tsl, TWO), b)), constant(tsl, 1)),
  // max(1 − (1 − a) / max(b, ε), 0)
  'color-burn': (tsl, a, b) =>
    tsl.max(
      tsl.oneMinus(tsl.div(tsl.oneMinus(a), tsl.max(b, constant(tsl, DIVISION_GUARD)))),
      constant(tsl, 0),
    ),
  // min(a / max(1 − b, ε), 1)
  'color-dodge': (tsl, a, b) =>
    tsl.min(tsl.div(a, tsl.max(tsl.oneMinus(b), constant(tsl, DIVISION_GUARD))), constant(tsl, 1)),
  darken: (tsl, a, b) => tsl.min(a, b),
  lighten: (tsl, a, b) => tsl.max(a, b),
  difference: (tsl, a, b) => tsl.abs(tsl.sub(a, b)),
  add: (tsl, a, b) => tsl.add(a, b),
  subtract: (tsl, a, b) => tsl.sub(a, b),
}

export const blendNode = defineNode({
  type: 'color/blend',
  category: 'color',
  label: 'Blend',
  description:
    'Layers one color over another with a Photoshop-style blend mode, faded in by Opacity.',
  formula: 'mix(Base, mode, Opacity)',
  keywords: ['blend', 'mix', 'layer', 'multiply', 'screen', 'overlay', 'composite', 'photoshop'],
  inputs: [
    {
      id: 'base',
      label: 'Base',
      type: generic(TYPE_GROUP),
      default: vec3(0.5, 0.5, 0.5),
      widget: 'color',
      description: 'The color underneath, which the blend layer is applied to.',
    },
    {
      id: 'blend',
      label: 'Blend',
      type: generic(TYPE_GROUP),
      default: vec3(1, 1, 1),
      widget: 'color',
      description: 'The color layered on top of Base.',
    },
    {
      id: 'opacity',
      label: 'Opacity',
      type: concrete('float'),
      default: float(1),
      description: 'How strongly the blend shows: 0 = only Base, 1 = the full blend mode.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'Base with the blend mode applied at the chosen opacity.',
    },
  ],
  params: [
    { id: 'mode', label: 'Mode', kind: 'enum', options: MODE_OPTIONS, default: DEFAULT_MODE },
  ],
  build: ({ tsl, inputs, params }) => {
    const mode = resolveEnumParam(MODE_OPTIONS, params.mode, DEFAULT_MODE)
    return {
      out: tsl.mix(
        inputs.base,
        MODE_EXPRESSIONS[mode](tsl, inputs.base, inputs.blend),
        inputs.opacity,
      ),
    }
  },
})
