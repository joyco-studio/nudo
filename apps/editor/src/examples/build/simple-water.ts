import { float } from '@nudo-tsl/core'

import type { ExampleSpec } from './example-spec'
import { node, reader } from './example-spec'
import { hexColor } from './hex-color'

/**
 * The phase-1 water snippet with its colors and wave settings as properties: sine waves over the
 * UV blend a deep and a shallow color, and a fresnel rim glows on the edges.
 */
export const SIMPLE_WATER: ExampleSpec = {
  properties: [
    { name: 'waveFrequency', label: 'Wave frequency', value: float(12) },
    { name: 'waveSpeed', label: 'Wave speed', value: float(1.5) },
    { name: 'deepColor', label: 'Deep color', value: hexColor('#082040'), widget: 'color' },
    { name: 'shallowColor', label: 'Shallow color', value: hexColor('#50C3CF'), widget: 'color' },
    { name: 'rimColor', label: 'Rim color', value: hexColor('#61A0B4'), widget: 'color' },
  ],
  groups: [
    {
      id: 'waves',
      title: 'Waves',
      es: {
        title: 'Olas',
        body: 'UV × frecuencia + Time × velocidad, por un seno: franjas que ruedan sobre la superficie. La mitad más un medio lleva la ola de -1…1 a 0…1.',
      },
      body:
        'UV × frequency + Time × speed, through a sine: stripes that roll across the surface. ' +
        'Half of it plus a half takes the wave from -1…1 to 0…1.',
      nodes: [
        node('uv', 'input/uv'),
        reader('waveFrequency', 'waveFrequency'),
        node('uvScaled', 'math/multiply'),
        node('time', 'input/time'),
        reader('waveSpeed', 'waveSpeed'),
        node('timeScaled', 'math/multiply'),
        node('phase', 'math/add'),
        node('wave', 'math/sin'),
        node('waveHalf', 'math/multiply', { b: float(0.5) }),
        node('wave01', 'math/add', { b: float(0.5) }),
      ],
    },
    {
      id: 'water-color',
      title: 'Water color',
      es: {
        title: 'Color del agua',
        body: 'La ola elige entre el color profundo y el de agua baja.',
      },
      body: 'The wave picks between the deep and the shallow color.',
      nodes: [
        reader('deep', 'deepColor'),
        reader('shallow', 'shallowColor'),
        node('waterColor', 'interpolation/lerp'),
      ],
    },
    {
      id: 'rim',
      title: 'Rim',
      es: {
        title: 'Borde',
        body: 'Fresnel ilumina los bordes que se alejan de vos.',
      },
      body: 'Fresnel lights the edges that turn away from you.',
      nodes: [
        node('fresnel', 'effects/fresnel', { power: float(3) }),
        reader('rim', 'rimColor'),
        node('rimGlow', 'math/multiply'),
      ],
    },
  ],
  wires: [
    ['uv.out', 'uvScaled.a'],
    ['waveFrequency.out', 'uvScaled.b'],
    ['time.out', 'timeScaled.a'],
    ['waveSpeed.out', 'timeScaled.b'],
    ['uvScaled.out', 'phase.a'],
    ['timeScaled.out', 'phase.b'],
    ['phase.out', 'wave.in'],
    ['wave.out', 'waveHalf.a'],
    ['waveHalf.out', 'wave01.a'],
    ['deep.out', 'waterColor.a'],
    ['shallow.out', 'waterColor.b'],
    ['wave01.out', 'waterColor.t'],
    ['fresnel.out', 'rimGlow.a'],
    ['rim.out', 'rimGlow.b'],
    ['waterColor.out', 'master.baseColor'],
    ['rimGlow.out', 'master.emission'],
  ],
  master: {
    inputs: { metalness: float(0.1), roughness: float(0.08), opacity: float(0.85) },
  },
}
