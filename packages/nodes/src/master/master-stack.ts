import { MASTER_NODE_TYPE, concrete, defineNode, float, vec3 } from '@nudo-tsl/core'

export const masterStackNode = defineNode({
  type: MASTER_NODE_TYPE,
  category: 'master',
  label: 'Master',
  description: 'Final surface output that every shader graph ends in.',
  keywords: ['master', 'output', 'material', 'surface'],
  inputs: [
    {
      id: 'position',
      label: 'Position',
      type: concrete('vec3'),
      default: vec3(0, 0, 0),
      optional: true,
    },
    {
      id: 'baseColor',
      label: 'Base Color',
      type: concrete('vec3'),
      default: vec3(0.8, 0.8, 0.8),
      widget: 'color',
    },
    {
      id: 'emission',
      label: 'Emission',
      type: concrete('vec3'),
      default: vec3(0, 0, 0),
      widget: 'color',
    },
    { id: 'metalness', label: 'Metalness', type: concrete('float'), default: float(0) },
    { id: 'roughness', label: 'Roughness', type: concrete('float'), default: float(0.5) },
    {
      id: 'normal',
      label: 'Normal',
      type: concrete('vec3'),
      default: vec3(0, 0, 1),
      optional: true,
    },
    { id: 'opacity', label: 'Opacity', type: concrete('float'), default: float(1) },
  ],
  outputs: [],
  build: () => ({}),
})
