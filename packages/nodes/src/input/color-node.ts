import { concrete, defineNode, vec3 } from '@nudo-tsl/core'

export const colorNode = defineNode({
  type: 'input/color',
  category: 'input',
  label: 'Color',
  description: 'A constant RGB color picked with a color swatch.',
  keywords: ['color', 'colour', 'rgb', 'constant', 'swatch'],
  inputs: [
    {
      id: 'color',
      label: 'Color',
      description: 'The color to output.',
      type: concrete('vec3'),
      default: vec3(1, 1, 1),
      widget: 'color',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec3'),
      description: 'The color you picked, as red, green and blue.',
    },
  ],
  build: ({ inputs }) => ({ out: inputs.color }),
})
