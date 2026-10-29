import { concrete, defineNode, float, vec3 } from '@nudo-tsl/core'
import {
  VORONOI_DISTANCE_PARAM,
  VORONOI_EXPONENT_INPUT,
  buildVoronoiOutputs,
} from './voronoi-cells'

export const voronoi3dNode = defineNode({
  type: 'effects/voronoi-3d',
  category: 'effects',
  label: 'Voronoi 3D',
  description:
    'Cellular pattern in 3D space: cells that fill the volume, not stretched over the UV.',
  formula: 'voronoi(Position × Scale)',
  keywords: ['voronoi', '3d', 'cellular', 'cells', 'worley', 'volume', 'stone', 'procedural'],
  inputs: [
    {
      id: 'position',
      label: 'Position',
      type: concrete('vec3'),
      default: vec3(0, 0, 0),
      fallback: 'positionLocal',
      description: 'Where to sample the cells; the object position when nothing is plugged in.',
    },
    {
      id: 'scale',
      label: 'Scale',
      type: concrete('float'),
      default: float(5),
      description: 'How many cells fit in one unit of space.',
    },
    {
      id: 'jitter',
      label: 'Jitter',
      type: concrete('float'),
      default: float(1),
      description: 'How irregular the cells are: 0 = a cubic grid, 1 = fully random.',
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
      description: 'F2 minus F1: near 0 along the walls between cells, for cracks and outlines.',
    },
    {
      id: 'cell',
      label: 'Cell',
      type: concrete('vec3'),
      description: 'The center of the nearest cell, in Position × Scale units: one value per cell.',
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
      3,
      tsl.mul(inputs.position, inputs.scale),
      inputs.jitter,
      inputs.exponent,
      params,
    ),
})
