import { concrete, defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

export const distanceNode = defineNode({
  type: 'math/distance',
  category: 'math',
  label: 'Distance',
  description: 'Measures the distance between two points.',
  keywords: ['distance', 'length', 'gap', 'between'],
  inputs: [
    { id: 'a', label: 'A', type: generic(TYPE_GROUP), default: float(0) },
    { id: 'b', label: 'B', type: generic(TYPE_GROUP), default: float(0) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  build: ({ tsl, inputs }) => ({ out: tsl.distance(inputs.a, inputs.b) }),
})
