import { defineNode, float, generic } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'

/**
 * A dot that bends a connection on the canvas. It hands its input on unchanged, so it never
 * changes the shader: its type follows whatever feeds it.
 */
export const rerouteNode = defineNode({
  type: 'utility/reroute',
  category: 'utility',
  label: 'Reroute',
  description: 'A point that bends a connection. It passes its value through unchanged.',
  formula: 'In',
  keywords: ['reroute', 'dot', 'knot', 'elbow', 'redirect', 'wire', 'pass through'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP),
      default: float(0),
      description: 'The value the connection carries, of any vector type.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: generic(TYPE_GROUP),
      description: 'The same value, unchanged, for wherever the connection goes next.',
    },
  ],
  passthrough: true,
  build: ({ inputs }) => ({ out: inputs.in }),
})
