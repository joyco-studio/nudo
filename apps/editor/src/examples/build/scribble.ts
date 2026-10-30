import { float, vec2 } from '@nudo-tsl/core'

import type { ExampleSpec } from './example-spec'
import { node, reader } from './example-spec'
import {
  INK_MASK_IN,
  INK_NODES,
  INK_WIRES,
  PAPER_NODES,
  PAPER_TEXT,
  PAPER_WIRES,
  TONE_NODES,
  TONE_OUT,
  TONE_TEXT,
  TONE_WIRES,
  contrast,
  inkColor,
  paperColor,
} from './sketch-paper'

/** Radians of the stroke wave per unit of view space. */
const STROKE_DENSITY = 300
/** The strokes lean a little, like handwriting. */
const STROKE_SLANT = 0.35
/** Phase where a stroke ends: the trough of the sine, −π/2, so each stroke is whole. */
const STROKE_START = -Math.PI / 2
const STROKE_END = (3 * Math.PI) / 2

/**
 * After spite's "Scribble I" (github.com/spite/sketch, MIT, inktober 2020): loose pen strokes that
 * wobble like handwriting and crowd together in the shadows. spite warps rings with a sum of sines;
 * here a fractal noise bends parallel strokes, and the Random node gives each stroke its own pen
 * pressure, so no two lines have the same weight.
 */
export const SCRIBBLE: ExampleSpec = {
  properties: [
    { name: 'strokeDensity', label: 'Stroke density', value: float(STROKE_DENSITY) },
    { name: 'wobble', label: 'Wobble', value: float(0.04) },
    { name: 'wobbleScale', label: 'Wobble scale', value: float(12) },
    { name: 'pressure', label: 'Pen pressure', value: float(0.2) },
    inkColor('#14690A'),
    paperColor('#E3CBB0'),
    contrast(1.8),
  ],
  groups: [
    { id: 'light', ...TONE_TEXT, nodes: TONE_NODES },
    {
      id: 'wobble',
      title: 'Wobble',
      body:
        'A fractal noise over view space, scaled by Wobble: how far each stroke strays from a ' +
        'straight line. Wobble scale sets how tight its curves are.',
      es: {
        title: 'Temblor',
        body: 'Un noise fractal sobre el espacio de la vista, escalado por Wobble: cuánto se aparta cada trazo de la recta. Wobble scale define qué tan cerradas son sus curvas.',
      },
      nodes: [
        node('viewPosition', 'input/position', {}, { space: 'view' }),
        reader('wobbleScale', 'wobbleScale'),
        node('wobbleNoise', 'effects/noise', {}, { kind: 'simplex', octaves: 3 }),
        reader('wobble', 'wobble'),
        node('wobbleOffset', 'math/multiply'),
      ],
    },
    {
      id: 'strokes',
      title: 'Pen strokes',
      body:
        'The slanted Y plus the wobble, × density through a sine: wavy parallel strokes, ' +
        'remapped to 0…1.',
      es: {
        title: 'Trazos de lapicera',
        body: 'La Y inclinada más el temblor, × densidad por un seno: trazos paralelos ondulados, llevados a 0…1.',
      },
      nodes: [
        node('slanted', 'vector/rotate-2d', { angle: float(STROKE_SLANT), center: vec2(0, 0) }),
        node('slantedAxes', 'vector/split'),
        node('wobbled', 'math/add'),
        reader('strokeDensity', 'strokeDensity'),
        node('strokePhase', 'math/multiply'),
        node('strokeWave', 'math/sin'),
        node('wave', 'math/remap', { inMin: float(-1), inMax: float(1) }),
      ],
    },
    {
      id: 'pressure',
      title: 'Pen pressure',
      body:
        'Remap counts the strokes (one per turn of the sine, cut where it is lowest) and Floor ' +
        'numbers them. Random turns each number into its own value, so every stroke presses a ' +
        'little harder or softer.',
      es: {
        title: 'Presión de la lapicera',
        body: 'Remap cuenta los trazos (uno por vuelta del seno, cortados donde está más bajo) y Floor los numera. Random convierte cada número en su propio valor, así cada trazo aprieta un poco más o menos.',
      },
      nodes: [
        node('strokeCount', 'math/remap', {
          inMin: float(STROKE_START),
          inMax: float(STROKE_END),
        }),
        node('strokeIndex', 'math/floor'),
        node('strokeRandom', 'math/hash'),
        node('strokeJitter', 'math/subtract', { b: float(0.5) }),
        reader('pressure', 'pressure'),
        node('strokePressure', 'math/multiply'),
        node('pressedTone', 'math/add'),
      ],
    },
    {
      id: 'ink',
      title: 'Ink',
      body:
        'AA Step inks the wave where it rises above the pressed tone: in the shadows the strokes ' +
        'thicken until they run together.',
      es: {
        title: 'Tinta',
        body: 'AA Step entinta la onda donde supera al tono con la presión: en las sombras los trazos engordan hasta juntarse.',
      },
      nodes: [node('inkMask', 'interpolation/aa-step'), ...INK_NODES],
    },
    { id: 'paper', ...PAPER_TEXT, nodes: PAPER_NODES },
  ],
  wires: [
    ...TONE_WIRES,
    ['viewPosition.out', 'wobbleNoise.p'],
    ['wobbleScale.out', 'wobbleNoise.scale'],
    ['wobbleNoise.out', 'wobbleOffset.a'],
    ['wobble.out', 'wobbleOffset.b'],
    ['viewPosition.out', 'slanted.in'],
    ['slanted.out', 'slantedAxes.in'],
    ['slantedAxes.y', 'wobbled.a'],
    ['wobbleOffset.out', 'wobbled.b'],
    ['wobbled.out', 'strokePhase.a'],
    ['strokeDensity.out', 'strokePhase.b'],
    ['strokePhase.out', 'strokeWave.in'],
    ['strokeWave.out', 'wave.in'],
    ['strokePhase.out', 'strokeCount.in'],
    ['strokeCount.out', 'strokeIndex.in'],
    ['strokeIndex.out', 'strokeRandom.in'],
    ['strokeRandom.out', 'strokeJitter.a'],
    ['strokeJitter.out', 'strokePressure.a'],
    ['pressure.out', 'strokePressure.b'],
    [TONE_OUT, 'pressedTone.a'],
    ['strokePressure.out', 'pressedTone.b'],
    ['pressedTone.out', 'inkMask.edge'],
    ['wave.out', 'inkMask.in'],
    ...PAPER_WIRES,
    ['inkMask.out', INK_MASK_IN],
    ...INK_WIRES,
  ],
  master: { params: { lighting: 'unlit' } },
}
