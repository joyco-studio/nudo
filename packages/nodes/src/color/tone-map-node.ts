import { concrete, defineNode, float, vec3 } from '@nudo-tsl/core'
import type { ToneMapKind } from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

const DEFAULT_KIND: ToneMapKind = 'aces-filmic'
const DEFAULT_EXPOSURE = 1

const KIND_OPTIONS: readonly EnumOption<ToneMapKind>[] = [
  { value: 'aces-filmic', label: 'ACES Filmic' },
  { value: 'agx', label: 'AgX' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'reinhard', label: 'Reinhard' },
  { value: 'cineon', label: 'Cineon' },
  { value: 'linear', label: 'Linear' },
]

export const toneMapNode = defineNode({
  type: 'color/tone-map',
  category: 'color',
  label: 'Tone Map',
  description:
    "Rolls bright HDR light off into the displayable range with one of three.js's renderer curves, for unlit materials that should look tone mapped.",
  formula: 'curve(Color × Exposure)',
  keywords: ['tone map', 'tonemap', 'tone mapping', 'aces', 'agx', 'filmic', 'hdr', 'exposure'],
  inputs: [
    {
      id: 'color',
      label: 'Color',
      type: concrete('vec3'),
      default: vec3(1, 1, 1),
      widget: 'color',
      description: 'The linear HDR color to bring into range; values above 1 roll off softly.',
    },
    {
      id: 'exposure',
      label: 'Exposure',
      type: concrete('float'),
      default: float(DEFAULT_EXPOSURE),
      description: 'Brightens (above 1) or darkens (below 1) the color before the curve.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec3'),
      description: 'The color mapped into 0 to 1, still linear, ready for the screen.',
    },
  ],
  params: [
    { id: 'kind', label: 'Curve', kind: 'enum', options: KIND_OPTIONS, default: DEFAULT_KIND },
  ],
  build: ({ tsl, inputs, params }) => ({
    out: tsl.toneMap(
      resolveEnumParam(KIND_OPTIONS, params.kind, DEFAULT_KIND),
      inputs.color,
      inputs.exposure,
    ),
  }),
})
