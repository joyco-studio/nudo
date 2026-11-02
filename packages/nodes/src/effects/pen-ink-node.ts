import { concrete, defineNode, float, vec2 } from '@nudo-tsl/core'
import type { TslFacade } from '@nudo-tsl/core'

/**
 * Ballpoint ink after the pen of Profesora Ya's drawing pencil, where each instance is one nib
 * impression on the sheet. Here the impression is any stroke: Distance says how far a point is
 * from its center line, and the paper point fixes the ink flow and the paper's tooth in place.
 */
const DEFAULT_FLOW_SCALE = 60
const DEFAULT_TOOTH_SCALE = 600

/** Perlin turned into a flow of about 0…1, as `mx_noise_float(p, 0.75, 0.5)` does, then clamped. */
const FLOW_AMPLITUDE = 0.75
const FLOW_PIVOT = 0.5
/** The line's width follows the flow: 0.68 of the stroke where it runs dry, all of it when wet. */
const WIDTH_DRY = 0.68
const WIDTH_SPAN = 0.32
/** Where the solid core starts to soften, as a share of the width. */
const CORE_SHARE = 0.45
/** Darkness also follows the flow: 0.7 dry, 1 wet. */
const FLOW_DARK_DRY = 0.7
const FLOW_DARK_SPAN = 0.3
/** Pale spots of paper tooth: the line never drops below 0.65 of its ink. */
const TOOTH_EDGES = [0.1, 0.8] as const
const TOOTH_FLOOR = 0.65
const TOOTH_SPAN = 0.35
/** The dispersed ink's Gaussian falloff, exp(−4d²), shifted to reach 0 at the stroke's edge. */
const DIFFUSE_FALLOFF = -4
/** Pressure from which the ink stops spreading and becomes the ballpoint line. */
const LINE_PRESSURE = [0.02, 0.18] as const

interface PenInkInputs<E> {
  readonly distance: E
  readonly pressure: E
  readonly paper: E
  readonly flowScale: E
  readonly toothScale: E
}

/**
 * The ink's opacity, 0…1: a ballpoint line whose width and darkness follow a slow flow noise, with
 * pale specks of paper tooth, that spreads into a soft Gaussian smudge under light pressure.
 */
export function penInk<E>(tsl: TslFacade<E>, inputs: PenInkInputs<E>): E {
  const { distance, pressure, paper, flowScale, toothScale } = inputs
  const constant = (value: number): E => tsl.construct('float', [value])
  const zero = constant(0)
  const one = constant(1)

  const flowNoise = tsl.noise('perlin', tsl.mul(paper, flowScale))
  const flow = tsl.clamp(
    tsl.add(tsl.mul(flowNoise, constant(FLOW_AMPLITUDE)), constant(FLOW_PIVOT)),
    zero,
    one,
  )
  const width = tsl.add(tsl.mul(flow, constant(WIDTH_SPAN)), constant(WIDTH_DRY))
  const line = tsl.oneMinus(tsl.smoothstep(tsl.mul(width, constant(CORE_SHARE)), width, distance))
  const lineInk = tsl.mul(
    line,
    tsl.add(tsl.mul(flow, constant(FLOW_DARK_SPAN)), constant(FLOW_DARK_DRY)),
  )

  const fine = tsl.hash('float', tsl.floor(tsl.mul(paper, toothScale)), zero)
  const tooth = tsl.add(
    tsl.mul(
      tsl.smoothstep(constant(TOOTH_EDGES[0]), constant(TOOTH_EDGES[1]), fine),
      constant(TOOTH_SPAN),
    ),
    constant(TOOTH_FLOOR),
  )

  const diffuse = tsl.max(
    tsl.sub(
      tsl.exp(tsl.mul(tsl.mul(distance, distance), constant(DIFFUSE_FALLOFF))),
      constant(Math.exp(DIFFUSE_FALLOFF)),
    ),
    zero,
  )
  const toLine = tsl.smoothstep(constant(LINE_PRESSURE[0]), constant(LINE_PRESSURE[1]), pressure)
  const coverage = tsl.mul(tsl.mix(diffuse, lineInk, toLine), tooth)
  return tsl.clamp(tsl.mul(coverage, pressure), zero, one)
}

export const penInkNode = defineNode({
  type: 'effects/pen-ink',
  category: 'effects',
  label: 'Pen Ink',
  description:
    'Ballpoint ink along a stroke: a line whose width and darkness wander with the ink flow, specked by the paper tooth, that spreads into a soft smudge under light pressure.',
  formula: 'pen(Distance, Pressure)',
  keywords: ['pen', 'ink', 'ballpoint', 'stroke', 'line', 'drawing', 'sketch', 'paper', 'hatch'],
  inputs: [
    {
      id: 'distance',
      label: 'Distance',
      type: concrete('float'),
      default: float(0),
      description:
        "How far the point is from the stroke's center line: 0 on it, 1 at its edge. Length of a centered UV × 2 draws one dot.",
    },
    {
      id: 'pressure',
      label: 'Pressure',
      type: concrete('float'),
      default: float(1),
      description:
        'How much ink lands, 0 to 1: near 0 a faint spread smudge, from about 0.2 the full ballpoint line.',
    },
    {
      id: 'paper',
      label: 'Paper',
      type: concrete('vec2'),
      default: vec2(0, 0),
      fallback: 'uv',
      description:
        "Where the point sits on the sheet: the ink flow and the paper's tooth stay fixed to it. The mesh UV when nothing is plugged in.",
    },
    {
      id: 'flowScale',
      label: 'Flow Scale',
      type: concrete('float'),
      default: float(DEFAULT_FLOW_SCALE),
      description:
        'How quickly the ink flow changes along the paper: higher = shorter wet and dry runs.',
    },
    {
      id: 'toothScale',
      label: 'Tooth Scale',
      type: concrete('float'),
      default: float(DEFAULT_TOOTH_SCALE),
      description: "How fine the paper's tooth is: cells per unit of Paper.",
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('float'),
      description:
        'How much ink covers the point, 0 to 1: plug it into a Blend opacity to lay the ink over paper.',
    },
  ],
  build: ({ tsl, inputs }) => ({ out: penInk(tsl, inputs) }),
})
