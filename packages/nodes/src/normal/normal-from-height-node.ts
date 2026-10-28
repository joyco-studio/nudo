import { concrete, defineNode, float } from '@nudo-tsl/core'

export const normalFromHeightNode = defineNode({
  type: 'normal/normal-from-height',
  category: 'normal',
  label: 'Normal From Height',
  description: 'Turns a height value, such as noise, into bumps the lighting can see.',
  keywords: ['normal', 'height', 'bump', 'derivative', 'relief', 'ripple'],
  inputs: [
    {
      id: 'height',
      label: 'Height',
      type: concrete('float'),
      default: float(0),
      description: 'The height at this point: higher values stand out more.',
    },
    {
      id: 'strength',
      label: 'Strength',
      type: concrete('float'),
      default: float(1),
      description: 'How bumpy the result looks: 0 = flat.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec3'),
      description: "A surface direction for the Master Stack's Normal input.",
    },
  ],
  build: ({ tsl, inputs }) => ({ out: tsl.normalFromHeight(inputs.height, inputs.strength) }),
})
