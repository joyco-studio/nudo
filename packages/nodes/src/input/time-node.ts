import { concrete, defineNode } from '@nudo-tsl/core'

export const timeNode = defineNode({
  type: 'input/time',
  category: 'input',
  label: 'Time',
  description: 'Seconds elapsed since the shader started, for animating values.',
  keywords: ['time', 'seconds', 'animate', 'clock'],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  build: ({ tsl }) => ({ out: tsl.builtin('time') }),
})
