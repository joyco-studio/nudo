import { MASTER_NODE_TYPE, concrete, defineNode, float, vec3 } from '@nudo-tsl/core'

const LIGHTING_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'unlit', label: 'Unlit' },
] as const

const SURFACE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'opaque', label: 'Opaque' },
  { value: 'transparent', label: 'Transparent' },
] as const

export const masterStackNode = defineNode({
  type: MASTER_NODE_TYPE,
  category: 'master',
  label: 'Master',
  description: 'The finished material: whatever reaches these inputs is what the mesh shows.',
  keywords: ['master', 'output', 'material', 'surface'],
  inputs: [
    {
      id: 'position',
      label: 'Position',
      description:
        'Where each vertex goes, in object space; leave it empty to keep the mesh as it is.',
      type: concrete('vec3'),
      default: vec3(0, 0, 0),
      optional: true,
    },
    {
      id: 'baseColor',
      label: 'Base Color',
      description: 'The color of the surface before lighting.',
      type: concrete('vec3'),
      default: vec3(0.8, 0.8, 0.8),
      widget: 'color',
    },
    {
      id: 'emission',
      label: 'Emission',
      description: 'Light the surface gives off on its own, even in the dark; black adds none.',
      type: concrete('vec3'),
      default: vec3(0, 0, 0),
      widget: 'color',
    },
    {
      id: 'metalness',
      label: 'Metalness',
      type: concrete('float'),
      default: float(0),
      description: '0 = plastic, wood or stone, 1 = bare metal.',
    },
    {
      id: 'roughness',
      label: 'Roughness',
      type: concrete('float'),
      default: float(0.5),
      description: '0 = sharp mirror reflections, 1 = fully matte.',
    },
    {
      id: 'normal',
      label: 'Normal',
      description:
        'Which way the lighting thinks the surface faces; plug Normal From Height for bumps.',
      type: concrete('vec3'),
      default: vec3(0, 0, 1),
      optional: true,
    },
    {
      id: 'opacity',
      label: 'Opacity',
      type: concrete('float'),
      default: float(1),
      description: 'How solid the surface is: 0 = invisible, 1 = fully solid.',
    },
    {
      id: 'alphaClip',
      label: 'Alpha Clip Threshold',
      description: 'Pixels whose opacity is below this are cut away completely.',
      type: concrete('float'),
      default: float(0.5),
      optional: true,
    },
  ],
  outputs: [],
  params: [
    {
      id: 'lighting',
      label: 'Lighting',
      kind: 'enum',
      options: LIGHTING_OPTIONS,
      default: 'standard',
    },
    {
      id: 'surface',
      label: 'Surface',
      kind: 'enum',
      options: SURFACE_OPTIONS,
      default: 'auto',
    },
    { id: 'twoSided', label: 'Two sided', kind: 'boolean', default: false },
  ],
  build: () => ({}),
})
