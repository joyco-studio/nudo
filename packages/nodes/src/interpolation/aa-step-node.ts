import { concrete, defineNode, float } from '@nudo-tsl/core'

/** Smallest filter width, so a flat input still gets a valid smoothstep range. */
const MIN_FILTER_WIDTH = 1e-4
/** Fraction of the screen-space derivative used as the half width of the edge. */
const FILTER_WIDTH_SCALE = 0.75

export const aaStepNode = defineNode({
  type: 'interpolation/aa-step',
  category: 'interpolation',
  label: 'AA Step',
  description: 'Anti-aliased step that stays crisp but smooths the edge over about one pixel.',
  formula: 'In < Edge ? 0 : 1, soft edge',
  keywords: ['aastep', 'anti-alias', 'antialias', 'step', 'edge', 'threshold'],
  inputs: [
    {
      id: 'edge',
      label: 'Edge',
      type: concrete('float'),
      default: float(0.5),
      description: 'The threshold: values of In below it give 0.',
    },
    {
      id: 'in',
      label: 'In',
      type: concrete('float'),
      default: float(0),
      description: 'The value to test; smooth inputs such as gradients work best.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('float'),
      description: '0 below Edge and 1 above it, with an edge about one pixel soft.',
    },
  ],
  build: ({ tsl, inputs }) => {
    const width = tsl.mul(
      tsl.max(tsl.fwidth(inputs.in), tsl.construct('float', [MIN_FILTER_WIDTH])),
      tsl.construct('float', [FILTER_WIDTH_SCALE]),
    )
    return {
      out: tsl.smoothstep(tsl.sub(inputs.edge, width), tsl.add(inputs.edge, width), inputs.in),
    }
  },
})
