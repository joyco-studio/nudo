import { defineNode, generic, vec3 } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const normalizeNode = defineNode({
  type: 'vector/normalize',
  category: 'vector',
  label: 'Normalize',
  description: 'Scales a vector to a length of 1 while keeping its direction.',
  keywords: ['normalize', 'unit', 'direction', 'normalise'],
  inputs: [{ id: 'in', label: 'In', type: generic(TYPE_GROUP), default: vec3(0, 0, 1) }],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  build: ({ tsl, inputs }) => ({ out: tsl.normalize(inputs.in) }),
})
