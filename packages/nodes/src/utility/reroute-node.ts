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
  keywords: ['reroute', 'dot', 'knot', 'elbow', 'redirect', 'wire', 'pass through'],
  inputs: [{ id: 'in', label: 'In', type: generic(TYPE_GROUP), default: float(0) }],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  passthrough: true,
  build: ({ inputs }) => ({ out: inputs.in }),
})
