import { float } from '@nudo-tsl/core'

import type { ExampleSpec } from './example-spec'
import { node, reader } from './example-spec'
import { hexColor } from './hex-color'

/**
 * The "iridescent blob" tutorial (.context/blob-tutorial-graph.html): Time-driven noise breathes
 * the surface out along its normals, a remapped mask picks between two colors and between glossy
 * and matte, and a fresnel adds a rim glow. Each of the tutorial's five steps is a frame.
 */
export const IRIDESCENT_BLOB: ExampleSpec = {
  properties: [
    { name: 'speed', label: 'speed', value: float(0.3) },
    { name: 'wobble', label: 'wobble', value: float(0.12) },
    { name: 'deepColor', label: 'deepColor', value: hexColor('#1B1F6B'), widget: 'color' },
    { name: 'hotColor', label: 'hotColor', value: hexColor('#FF4FA3'), widget: 'color' },
    { name: 'rimColor', label: 'rimColor', value: hexColor('#7CF7FF'), widget: 'color' },
  ],
  groups: [
    {
      id: 'animated-noise',
      title: '1 · Animated noise',
      es: {
        title: '1 · Noise animado',
        body: 'Position + (Time × speed) le da al Noise una coordenada que se desliza con el tiempo, así las manchas se mueven solas. El Remap pasa el noise de -1…1 a 0…1: la máscara.',
      },
      body:
        'Position + (Time × speed) gives the Noise a coordinate that slides over time, so the ' +
        'blotches move on their own. The Remap takes the noise from -1…1 to 0…1: the mask.',
      nodes: [
        node('pos', 'input/position'),
        node('time', 'input/time'),
        reader('speed', 'speed'),
        node('mul1', 'math/multiply'),
        node('add1', 'math/add'),
        node('noise', 'effects/noise', { scale: float(2.5) }, { kind: 'simplex' }),
        node('remap', 'math/remap', { inMin: float(-1), inMax: float(1) }),
      ],
    },
    {
      id: 'deform',
      title: '2 · Deform the shape',
      es: {
        title: '2 · Deformar la forma',
        body: 'Empuja cada vértice hacia afuera de su normal según el noise. wobble controla cuánto.',
      },
      body: 'Pushes each vertex out along its normal by the noise. wobble sets how far.',
      nodes: [
        node('normal', 'input/normal'),
        node('mul2', 'math/multiply'),
        reader('wobble', 'wobble'),
        node('mul3', 'math/multiply'),
        node('add2', 'math/add'),
      ],
    },
    {
      id: 'base-color',
      title: '3 · Base color',
      es: {
        title: '3 · Color base',
        body: 'La máscara elige entre los 2 colores punto por punto.',
      },
      body: 'The mask picks between the two colors, point by point.',
      nodes: [
        reader('deep', 'deepColor'),
        reader('hot', 'hotColor'),
        node('smooth', 'interpolation/smoothstep', { edge0: float(0.35), edge1: float(0.65) }),
        node('lerp1', 'interpolation/lerp'),
      ],
    },
    {
      id: 'rim-glow',
      title: '4 · Rim glow',
      es: {
        title: '4 · Brillo de borde',
        body: 'Fresnel = 1 en los bordes y 0 de frente: glow de borde.',
      },
      body: 'Fresnel is 1 at the edges and 0 facing you: a glow around the rim.',
      nodes: [
        node('fresnel', 'effects/fresnel', { power: float(3) }),
        reader('rim', 'rimColor'),
        node('mul4', 'math/multiply'),
      ],
    },
    {
      id: 'material',
      title: '5 · Material',
      es: {
        title: '5 · Material',
        body: 'Brilloso en unas zonas, mate en otras.',
      },
      body: 'Glossy in some areas, matte in others.',
      nodes: [node('lerp2', 'interpolation/lerp', { a: float(0.15), b: float(0.6) })],
    },
  ],
  wires: [
    ['time.out', 'mul1.a'],
    ['speed.out', 'mul1.b'],
    ['pos.out', 'add1.a'],
    ['mul1.out', 'add1.b'],
    ['add1.out', 'noise.p'],
    ['noise.out', 'remap.in'],
    ['normal.out', 'mul2.a'],
    ['noise.out', 'mul2.b'],
    ['mul2.out', 'mul3.a'],
    ['wobble.out', 'mul3.b'],
    ['pos.out', 'add2.a'],
    ['mul3.out', 'add2.b'],
    ['add2.out', 'master.position'],
    ['deep.out', 'lerp1.a'],
    ['hot.out', 'lerp1.b'],
    ['remap.out', 'smooth.in'],
    ['smooth.out', 'lerp1.t'],
    ['lerp1.out', 'master.baseColor'],
    ['fresnel.out', 'mul4.a'],
    ['rim.out', 'mul4.b'],
    ['mul4.out', 'master.emission'],
    ['remap.out', 'lerp2.t'],
    ['lerp2.out', 'master.roughness'],
  ],
  master: { inputs: { metalness: float(0.2) }, params: { lighting: 'standard' } },
}
