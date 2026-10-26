import { concrete, defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const remapNode = defineNode({
  type: 'math/remap',
  category: 'math',
  label: 'Remap',
  description: 'Maps the input from one range of values to another.',
  keywords: ['remap', 'map', 'range', 'rescale', 'normalize'],
  inputs: [
    { id: 'in', label: 'In', type: generic(TYPE_GROUP), default: float(0.5) },
    { id: 'inMin', label: 'In Min', type: concrete('float'), default: float(0) },
    { id: 'inMax', label: 'In Max', type: concrete('float'), default: float(1) },
    { id: 'outMin', label: 'Out Min', type: concrete('float'), default: float(0) },
    { id: 'outMax', label: 'Out Max', type: concrete('float'), default: float(1) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({
    out: tsl.remap(inputs.in, inputs.inMin, inputs.inMax, inputs.outMin, inputs.outMax),
  }),
})
