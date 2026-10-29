import { concrete, defineNode, float, vec3 } from '@nudo-tsl/core'
import type { InputDefinition, ParamValue, TslFacade } from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

export const COLOR_RAMP_MAX_STOPS = 8
export const COLOR_RAMP_MIN_STOPS = 2
const COLOR_RAMP_DEFAULT_STOPS = COLOR_RAMP_MIN_STOPS
const COUNT_PARAM = 'count'

/** Keeps the division finite when two stops share a position. */
const DIVISION_GUARD = 0.00001
const SMOOTH_COEFFICIENT_A = 3
const SMOOTH_COEFFICIENT_B = 2

type Interpolation = 'linear' | 'constant' | 'smooth'

const DEFAULT_INTERPOLATION: Interpolation = 'linear'

const INTERPOLATION_OPTIONS: readonly EnumOption<Interpolation>[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'constant', label: 'Constant' },
  { value: 'smooth', label: 'Smooth' },
]

type StopPositionId = `stop${string}Position`
type StopColorId = `stop${string}Color`
type ColorRampInputId = 'in' | StopPositionId | StopColorId

export function colorRampStopInputIds(index: number): {
  position: StopPositionId
  color: StopColorId
} {
  return { position: `stop${String(index)}Position`, color: `stop${String(index)}Color` }
}

/** The number of stops in play: the stored `count`, rounded and kept between 2 and 8. */
export function colorRampCount(params: Readonly<Record<string, ParamValue>>): number {
  const stored = params[COUNT_PARAM]
  if (typeof stored !== 'number' || !Number.isFinite(stored)) return COLOR_RAMP_DEFAULT_STOPS
  return Math.min(COLOR_RAMP_MAX_STOPS, Math.max(COLOR_RAMP_MIN_STOPS, Math.round(stored)))
}

function stopInputs(index: number): readonly InputDefinition<ColorRampInputId>[] {
  const number = index + 1
  const hiddenWhen = (params: Readonly<Record<string, ParamValue>>): boolean =>
    index >= colorRampCount(params)
  const isFirst = index === 0
  const ids = colorRampStopInputIds(index)
  return [
    {
      id: ids.position,
      label: `Position ${String(number)}`,
      type: concrete('float'),
      default: float(isFirst ? 0 : 1),
      description: `Where stop ${String(number)} sits along the ramp, from 0 to 1.`,
      hiddenWhen,
    },
    {
      id: ids.color,
      label: `Color ${String(number)}`,
      type: concrete('vec3'),
      default: isFirst ? vec3(0, 0, 0) : vec3(1, 1, 1),
      widget: 'color',
      description: `The color of stop ${String(number)}.`,
      hiddenWhen,
    },
  ]
}

const STOP_INDEXES = Array.from({ length: COLOR_RAMP_MAX_STOPS }, (_, index) => index)

interface Stop<E> {
  readonly position: E
  readonly color: E
}

function readStops<E>(inputs: Readonly<Record<string, E>>, count: number): readonly Stop<E>[] {
  return STOP_INDEXES.slice(0, count).map((index) => {
    const ids = colorRampStopInputIds(index)
    const position = inputs[ids.position]
    const color = inputs[ids.color]
    if (position === undefined || color === undefined) {
      throw new Error(`Color ramp is missing the inputs of stop ${String(index)}`)
    }
    return { position, color }
  })
}

const constantValue = <E>(tsl: TslFacade<E>, value: number): E => tsl.construct('float', [value])

/** How far `value` has travelled from stop `from` to stop `to`, between 0 and 1. */
function segmentProgress<E>(tsl: TslFacade<E>, value: E, from: Stop<E>, to: Stop<E>): E {
  const span = tsl.max(tsl.sub(to.position, from.position), constantValue(tsl, DIVISION_GUARD))
  return tsl.clamp(
    tsl.div(tsl.sub(value, from.position), span),
    constantValue(tsl, 0),
    constantValue(tsl, 1),
  )
}

/** t·t·(3 − 2t): eases the ends of a segment. */
function smoothProgress<E>(tsl: TslFacade<E>, t: E): E {
  return tsl.mul(
    tsl.mul(t, t),
    tsl.sub(
      constantValue(tsl, SMOOTH_COEFFICIENT_A),
      tsl.mul(constantValue(tsl, SMOOTH_COEFFICIENT_B), t),
    ),
  )
}

function easeProgress<E>(tsl: TslFacade<E>, interpolation: Interpolation, t: E): E {
  return interpolation === 'smooth' ? smoothProgress(tsl, t) : t
}

export const colorRampNode = defineNode({
  type: 'color/color-ramp',
  category: 'color',
  label: 'Color Ramp',
  description:
    'Maps a value from 0 to 1 onto a gradient of up to eight colors, each with its own position.',
  formula: 'ramp(In)',
  keywords: ['color', 'ramp', 'gradient', 'colorramp', 'map', 'palette', 'stops'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: concrete('float'),
      default: float(0.5),
      description: 'The value to look up on the ramp: 0 is the first stop, 1 the last.',
    },
    ...STOP_INDEXES.flatMap(stopInputs),
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec3'),
      description: 'The ramp color at In.',
    },
  ],
  params: [
    {
      id: COUNT_PARAM,
      label: 'Stops',
      kind: 'number',
      min: COLOR_RAMP_MIN_STOPS,
      max: COLOR_RAMP_MAX_STOPS,
      step: 1,
      default: COLOR_RAMP_DEFAULT_STOPS,
      hidden: true,
    },
    {
      id: 'interpolation',
      label: 'Interpolation',
      kind: 'enum',
      options: INTERPOLATION_OPTIONS,
      default: DEFAULT_INTERPOLATION,
    },
  ],
  build: ({ tsl, inputs, params }) => {
    const interpolation = resolveEnumParam(
      INTERPOLATION_OPTIONS,
      params.interpolation,
      DEFAULT_INTERPOLATION,
    )
    const [first, ...rest] = readStops(inputs, colorRampCount(params))
    if (first === undefined) throw new Error('Color ramp has no stops')

    let color = first.color
    let previous = first
    for (const stop of rest) {
      const weight =
        interpolation === 'constant'
          ? tsl.step(stop.position, inputs.in)
          : easeProgress(tsl, interpolation, segmentProgress(tsl, inputs.in, previous, stop))
      color = tsl.mix(color, stop.color, weight)
      previous = stop
    }
    return { out: color }
  },
})
