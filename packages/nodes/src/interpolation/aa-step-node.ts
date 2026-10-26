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
  keywords: ['aastep', 'anti-alias', 'antialias', 'step', 'edge', 'threshold'],
  inputs: [
    { id: 'edge', label: 'Edge', type: concrete('float'), default: float(0.5) },
    { id: 'in', label: 'In', type: concrete('float'), default: float(0) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
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
