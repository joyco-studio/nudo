import { concrete, defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'
const POINT_TYPES = ['float', 'vec2', 'vec3'] as const

export const hashNode = defineNode({
  type: 'math/hash',
  category: 'math',
  label: 'Random',
  description: 'White noise: every position gets its own random value, the same on every frame.',
  formula: 'hash(In, Seed)',
  keywords: ['random', 'hash', 'noise', 'white noise', 'seed', 'rand', 'scatter'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP, POINT_TYPES),
      default: float(0),
      fallback: 'uv',
      description:
        'Where to read the randomness: the mesh UV when nothing is plugged in. The same value always gives the same result.',
    },
    {
      id: 'seed',
      label: 'Seed',
      type: concrete('float'),
      default: float(0),
      description: 'Pick a number to get a different random pattern from the same input.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('float'),
      description: 'One random value from 0 up to just under 1.',
    },
    {
      id: 'out3',
      label: 'Out3',
      type: concrete('vec3'),
      description:
        'Three unrelated random values from 0 up to just under 1, e.g. for a random color.',
    },
  ],
  build: ({ tsl, inputs }) => ({
    out: tsl.hash('float', inputs.in, inputs.seed),
    out3: tsl.hash('vec3', inputs.in, inputs.seed),
  }),
})
