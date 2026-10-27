import { concrete, defineNode, float } from '@nudo-tsl/core'

export const floatNode = defineNode({
  type: 'input/float',
  category: 'input',
  label: 'Float',
  description: 'A constant number you can edit and feed into other nodes.',
  keywords: ['float', 'number', 'scalar', 'constant', 'value'],
  inputs: [
    {
      id: 'x',
      label: 'X',
      type: concrete('float'),
      default: float(0),
      description: 'The number to output.',
    },
  ],
  outputs: [
    { id: 'out', label: 'Out', type: concrete('float'), description: 'The number you set.' },
  ],
  build: ({ inputs }) => ({ out: inputs.x }),
})
