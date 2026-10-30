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

/** A full turn, in radians: Random's 0…1 becomes any direction. */
const FULL_TURN = 2 * Math.PI
/** Radians of the stroke wave per patch: about four strokes across each one. */
const STROKE_DENSITY = 26

/**
 * After spite's "Patch I" (github.com/spite/sketch, MIT, inktober 2020): the surface is split into
 * patches and each patch is filled with short parallel strokes in a direction of its own, denser
 * where the light drops. spite jitters a grid by hand; here Voronoi finds the patches, the Random
 * node turns each patch's center into its stroke angle, and Voronoi's own Random shades each patch
 * a little differently.
 */
export const PATCH: ExampleSpec = {
  properties: [
    { name: 'patchScale', label: 'Patch scale', value: float(9) },
    { name: 'strokeDensity', label: 'Stroke density', value: float(STROKE_DENSITY) },
    { name: 'patchShade', label: 'Patch shading', value: float(0.25) },
    { name: 'seed', label: 'Seed', value: float(0) },
    inkColor('#1A2A9C'),
    paperColor('#D9B595'),
    contrast(1.4),
  ],
  groups: [
    { id: 'light', ...TONE_TEXT, nodes: TONE_NODES },
    {
      id: 'patches',
      title: 'Patches',
      body:
        'View-space position × patch scale, split into Voronoi cells: Cell is the center of ' +
        'the patch a point falls in. Subtracting it gives the point relative to its patch.',
      es: {
        title: 'Parches',
        body: 'La posición en el espacio de la vista × patch scale, dividida en celdas de Voronoi: Cell es el centro del parche donde cae cada punto. Restarlo da el punto relativo a su parche.',
      },
      nodes: [
        node('viewPosition', 'input/position', {}, { space: 'view' }),
        reader('patchScale', 'patchScale'),
        node('patchSpace', 'math/multiply'),
        node('patches', 'effects/voronoi', { scale: float(1) }),
        node('inPatch', 'math/subtract'),
      ],
    },
    {
      id: 'directions',
      title: 'A direction per patch',
      body:
        'Random turns each patch center into a value of its own (Seed deals another hand); × 2π ' +
        'it becomes the angle that turns the strokes inside that patch.',
      es: {
        title: 'Una dirección por parche',
        body: 'Random convierte el centro de cada parche en un valor propio (Seed reparte otra mano); × 2π se vuelve el ángulo que gira los trazos de ese parche.',
      },
      nodes: [
        reader('seed', 'seed'),
        node('patchRandom', 'math/hash'),
        node('patchAngle', 'math/multiply', { b: float(FULL_TURN) }),
        node('turned', 'vector/rotate-2d', { center: vec2(0, 0) }),
        node('turnedAxes', 'vector/split'),
        reader('strokeDensity', 'strokeDensity'),
        node('strokePhase', 'math/multiply'),
        node('strokeWave', 'math/sin'),
        node('wave', 'math/remap', { inMin: float(-1), inMax: float(1) }),
      ],
    },
    {
      id: 'patch-shade',
      title: 'Patch shading',
      body:
        "Voronoi's Random, from -½ to ½ × patch shading, nudges the tone per patch, so " +
        'neighbouring patches ink a little lighter or darker.',
      es: {
        title: 'Sombra por parche',
        body: 'El Random de Voronoi, de -½ a ½ × patch shading, corre el tono en cada parche, así parches vecinos entintan un poco más claro o más oscuro.',
      },
      nodes: [
        node('patchJitter', 'math/subtract', { b: float(0.5) }),
        reader('patchShade', 'patchShade'),
        node('patchOffset', 'math/multiply'),
        node('patchTone', 'math/add'),
      ],
    },
    {
      id: 'ink',
      title: 'Ink',
      body:
        'AA Step inks the strokes where the wave rises above the patch tone: in the shadows they ' +
        'thicken until each patch fills in.',
      es: {
        title: 'Tinta',
        body: 'AA Step entinta los trazos donde la onda supera al tono del parche: en las sombras engordan hasta llenar cada parche.',
      },
      nodes: [node('inkMask', 'interpolation/aa-step'), ...INK_NODES],
    },
    { id: 'paper', ...PAPER_TEXT, nodes: PAPER_NODES },
  ],
  wires: [
    ...TONE_WIRES,
    ['viewPosition.out', 'patchSpace.a'],
    ['patchScale.out', 'patchSpace.b'],
    ['patchSpace.out', 'patches.uv'],
    ['patchSpace.out', 'inPatch.a'],
    ['patches.cell', 'inPatch.b'],
    ['patches.cell', 'patchRandom.in'],
    ['seed.out', 'patchRandom.seed'],
    ['patchRandom.out', 'patchAngle.a'],
    ['inPatch.out', 'turned.in'],
    ['patchAngle.out', 'turned.angle'],
    ['turned.out', 'turnedAxes.in'],
    ['turnedAxes.y', 'strokePhase.a'],
    ['strokeDensity.out', 'strokePhase.b'],
    ['strokePhase.out', 'strokeWave.in'],
    ['strokeWave.out', 'wave.in'],
    ['patches.random', 'patchJitter.a'],
    ['patchJitter.out', 'patchOffset.a'],
    ['patchShade.out', 'patchOffset.b'],
    [TONE_OUT, 'patchTone.a'],
    ['patchOffset.out', 'patchTone.b'],
    ['patchTone.out', 'inkMask.edge'],
    ['wave.out', 'inkMask.in'],
    ...PAPER_WIRES,
    ['inkMask.out', INK_MASK_IN],
    ...INK_WIRES,
  ],
  master: { params: { lighting: 'unlit' } },
}
