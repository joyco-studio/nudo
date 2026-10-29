import { concrete, defineNode, float, vec3 } from '@nudo-tsl/core'

/** Contrast pivots around mid-grey, so raising it darkens the darks and lightens the lights. */
const CONTRAST_PIVOT = 0.5

export const brightContrastNode = defineNode({
  type: 'color/bright-contrast',
  category: 'color',
  label: 'Bright/Contrast',
  description:
    "Brightens a color and pushes its contrast around mid-grey, the same as Blender's Bright/Contrast.",
  formula: 'In × (1 + C) + B − C / 2',
  keywords: ['bright', 'brightness', 'contrast', 'levels', 'exposure', 'adjust', 'blender'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: concrete('vec3'),
      default: vec3(1, 1, 1),
      widget: 'color',
      description: 'The color to adjust.',
    },
    {
      id: 'brightness',
      label: 'Brightness',
      type: concrete('float'),
      default: float(0),
      description: 'Added to every channel: 0 leaves the color as it is, negative darkens.',
    },
    {
      id: 'contrast',
      label: 'Contrast',
      type: concrete('float'),
      default: float(0),
      description: 'How far channels move away from mid-grey: 0 = unchanged, negative flattens.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec3'),
      description: 'The adjusted color, never below 0.',
    },
  ],
  build: ({ tsl, inputs }) => {
    const gain = tsl.add(tsl.construct('float', [1]), inputs.contrast)
    const offset = tsl.sub(
      inputs.brightness,
      tsl.mul(inputs.contrast, tsl.construct('float', [CONTRAST_PIVOT])),
    )
    const adjusted = tsl.add(tsl.mul(inputs.in, gain), offset)
    return { out: tsl.max(adjusted, tsl.construct('vec3', [0])) }
  },
})
