import { MASTER_NODE_TYPE, OUTLINE_PARAM, concrete, defineNode, float, vec3 } from '@nudo-tsl/core'

const LIGHTING_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'unlit', label: 'Unlit' },
  { value: 'physical', label: 'Physical' },
] as const

/**
 * #6E6E6E in linear light: a mid grey, so the line reads on the preview's dark default background
 * (#0F0F0F) and on a light one alike.
 */
const OUTLINE_INK = 0.1559
/** Thin enough to read as a line on the 1-unit sphere, in scene units. */
const OUTLINE_WIDTH = 0.02
/** A steady line until the user asks for a wobble. */
const OUTLINE_WOBBLE = 0

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
      id: 'ambientOcclusion',
      label: 'Ambient Occlusion',
      description:
        'How much of the surrounding light reaches crevices: 1 = all of it, 0 = none. Connect a value to use it.',
      type: concrete('float'),
      default: float(1),
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
    {
      id: 'specularIntensity',
      label: 'Specular Intensity',
      description:
        'How strong the reflections are on a physical material: 1 = as usual, 0 = none. Connect a value to use it.',
      type: concrete('float'),
      default: float(1),
      optional: true,
    },
    {
      id: 'transmission',
      label: 'Transmission',
      description: 'How much light passes through the surface, like glass: 0 = none, 1 = all.',
      type: concrete('float'),
      default: float(0),
    },
    {
      id: 'ior',
      label: 'IOR',
      description: 'How much light bends on its way through: 1.5 is glass, 1.33 is water.',
      type: concrete('float'),
      default: float(1.5),
    },
    {
      id: 'thickness',
      label: 'Thickness',
      description: 'How deep the volume behind the surface is; deeper bends light more.',
      type: concrete('float'),
      default: float(0),
    },
    {
      id: 'clearcoat',
      label: 'Clearcoat',
      description: 'A clear varnish layer over the surface: 0 = none, 1 = a full coat.',
      type: concrete('float'),
      default: float(0),
    },
    {
      id: 'clearcoatRoughness',
      label: 'Clearcoat Roughness',
      description: '0 = glossy varnish, 1 = frosted varnish.',
      type: concrete('float'),
      default: float(0),
    },
    {
      id: 'sheen',
      label: 'Sheen',
      description:
        'The soft glow fabrics like velvet catch at grazing angles, as a color; black adds none.',
      type: concrete('vec3'),
      default: vec3(0, 0, 0),
      widget: 'color',
    },
    {
      id: 'sheenRoughness',
      label: 'Sheen Roughness',
      description: 'How far the sheen spreads: 0 = a thin rim, 1 = soft and broad.',
      type: concrete('float'),
      default: float(1),
    },
    {
      id: 'iridescence',
      label: 'Iridescence',
      description: 'Rainbow colors like a soap bubble or an oil film: 0 = none, 1 = full.',
      type: concrete('float'),
      default: float(0),
    },
    {
      id: 'iridescenceIOR',
      label: 'Iridescence IOR',
      description: 'How much the thin film bends light, which shifts its rainbow colors.',
      type: concrete('float'),
      default: float(1.3),
    },
    {
      id: 'outlineWidth',
      label: 'Outline Width',
      description: 'How far the line reaches past the surface, in scene units.',
      type: concrete('float'),
      default: float(OUTLINE_WIDTH),
    },
    {
      id: 'outlineColor',
      label: 'Outline Color',
      description: "The line's flat color; lighting never changes it.",
      type: concrete('vec3'),
      default: vec3(OUTLINE_INK, OUTLINE_INK, OUTLINE_INK),
      widget: 'color',
    },
    {
      id: 'outlineWobble',
      label: 'Outline Wobble',
      description:
        'How much the width swells and thins with a drifting noise, in scene units: 0 = steady.',
      type: concrete('float'),
      default: float(OUTLINE_WOBBLE),
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
    {
      id: OUTLINE_PARAM,
      label: 'Outline',
      kind: 'boolean',
      default: false,
      description:
        'Draws a flat line around the silhouette by drawing the mesh a second time. On a transparent surface, the line shows through.',
    },
    {
      id: 'useTransmission',
      label: 'Enable transmission',
      kind: 'boolean',
      default: false,
      description:
        'Lets light through the surface. To do it, three renders the scene behind once more.',
    },
    { id: 'useClearcoat', label: 'Enable clearcoat', kind: 'boolean', default: false },
    { id: 'useSheen', label: 'Enable sheen', kind: 'boolean', default: false },
    { id: 'useIridescence', label: 'Enable iridescence', kind: 'boolean', default: false },
  ],
  build: () => ({}),
})
