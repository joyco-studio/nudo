import { concrete, defineNode, float, vec2 } from '@nudo-tsl/core'

export const voronoiNode = defineNode({
  type: 'effects/voronoi',
  category: 'effects',
  label: 'Voronoi',
  description: 'Cellular pattern: distance to the nearest and second-nearest cell centers.',
  keywords: ['voronoi', 'cellular', 'cells', 'worley', 'distance', 'edge', 'procedural'],
  inputs: [
    { id: 'uv', label: 'UV', type: concrete('vec2'), default: vec2(0, 0), fallback: 'uv' },
    { id: 'scale', label: 'Scale', type: concrete('float'), default: float(5) },
    { id: 'jitter', label: 'Jitter', type: concrete('float'), default: float(1) },
  ],
  outputs: [
    { id: 'f1', label: 'F1', type: concrete('float') },
    { id: 'f2', label: 'F2', type: concrete('float') },
    { id: 'edge', label: 'Edge', type: concrete('float') },
  ],
  build: ({ tsl, inputs }) => {
    const cells = tsl.voronoi(tsl.mul(inputs.uv, inputs.scale), inputs.jitter)
    const f1 = tsl.swizzle(cells, 'x')
    const f2 = tsl.swizzle(cells, 'y')
    return { f1, f2, edge: tsl.sub(f2, f1) }
  },
})
