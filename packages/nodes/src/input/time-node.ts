import { concrete, defineNode } from '@nudo-tsl/core'

export const timeNode = defineNode({
  type: 'input/time',
  category: 'input',
  label: 'Time',
  description: 'Seconds elapsed since the shader started, for animating values.',
  keywords: ['time', 'seconds', 'animate', 'clock', 'delta'],
  inputs: [],
  // `out` stays the id of the plain time so graphs saved before the other outputs existed load.
  outputs: [
    { id: 'out', label: 'Out', type: concrete('float') },
    { id: 'sineTime', label: 'Sine Time', type: concrete('float') },
    { id: 'cosineTime', label: 'Cosine Time', type: concrete('float') },
    { id: 'deltaTime', label: 'Delta Time', type: concrete('float') },
  ],
  build: ({ tsl }) => {
    const time = tsl.builtin('time')
    return {
      out: time,
      sineTime: tsl.sin(time),
      cosineTime: tsl.cos(time),
      deltaTime: tsl.builtin('deltaTime'),
    }
  },
})
