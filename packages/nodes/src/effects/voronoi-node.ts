import { concrete, defineNode, float, vec2 } from '@nudo-tsl/core'
import {
  VORONOI_DISTANCE_PARAM,
  VORONOI_EXPONENT_INPUT,
  buildVoronoiOutputs,
} from './voronoi-cells'

export const voronoiNode = defineNode({
  type: 'effects/voronoi',
  category: 'effects',
  label: 'Voronoi',
  description: 'Cellular pattern: distance to the nearest and second-nearest cell centers.',
  formula: 'voronoi(UV × Scale)',
  keywords: ['voronoi', 'cellular', 'cells', 'worley', 'distance', 'edge', 'procedural'],
  inputs: [
    {
      id: 'uv',
      label: 'UV',
      type: concrete('vec2'),
      default: vec2(0, 0),
      fallback: 'uv',
      description: 'Where to sample the cells; the mesh UV when nothing is plugged in.',
    },
    {
      id: 'scale',
      label: 'Scale',
      type: concrete('float'),
      default: float(5),
      description: 'How many cells fit across the UV.',
    },
    {
      id: 'jitter',
      label: 'Jitter',
      type: concrete('float'),
      default: float(1),
      description: 'How irregular the cells are: 0 = a square grid, 1 = fully random.',
    },
    VORONOI_EXPONENT_INPUT,
  ],
  outputs: [
    {
      id: 'f1',
      label: 'F1',
      type: concrete('float'),
      description: 'Distance to the nearest cell center: 0 in the middle of each cell.',
    },
    {
      id: 'f2',
      label: 'F2',
      type: concrete('float'),
      description: 'Distance to the second-nearest cell center.',
    },
    {
      id: 'edge',
      label: 'Edge',
      type: concrete('float'),
      description: 'F2 minus F1: near 0 along the borders between cells, for cracks and outlines.',
    },
    {
      id: 'cell',
      label: 'Cell',
      type: concrete('vec2'),
      description: 'The center of the nearest cell, in UV × Scale units: one value per cell.',
    },
    {
      id: 'random',
      label: 'Random',
      type: concrete('float'),
      description: 'A random value from 0 to 1 per cell, to give each cell its own color.',
    },
  ],
  params: [VORONOI_DISTANCE_PARAM],
  build: ({ tsl, inputs, params }) =>
    buildVoronoiOutputs(
      tsl,
      2,
      tsl.mul(inputs.uv, inputs.scale),
      inputs.jitter,
      inputs.exponent,
      params,
    ),
})
