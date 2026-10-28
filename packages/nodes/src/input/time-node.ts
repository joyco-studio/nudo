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
    {
      id: 'out',
      label: 'Out',
      type: concrete('float'),
      description: 'Seconds since the shader started; it keeps growing.',
    },
    {
      id: 'sineTime',
      label: 'Sine Time',
      type: concrete('float'),
      description: 'Sine of Time: a wave that swings between -1 and 1.',
    },
    {
      id: 'cosineTime',
      label: 'Cosine Time',
      type: concrete('float'),
      description: 'Cosine of Time: the same wave as Sine Time, starting at 1.',
    },
    {
      id: 'deltaTime',
      label: 'Delta Time',
      type: concrete('float'),
      description: 'Seconds since the previous frame, for motion that ignores the frame rate.',
    },
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
