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

/** Radians of the stripe wave per unit of view space: about 90 lines across the preview's mesh. */
const LINE_DENSITY = 280
/** The lines run down to the right, like spite's. */
const LINE_ANGLE = 0.6

/**
 * After spite's "Lines I" (github.com/spite/sketch, MIT, inktober 2020): parallel lines fixed to
 * the screen whose thickness follows the shade over paper. spite compares the luma of a lit
 * render with a sine across the screen; here the Main Light's tone meets a sine across view space,
 * which stays square whatever the panel's shape.
 */
export const LINES: ExampleSpec = {
  properties: [
    { name: 'lineDensity', label: 'Line density', value: float(LINE_DENSITY) },
    { name: 'lineAngle', label: 'Line angle', value: float(LINE_ANGLE) },
    inkColor('#26241F'),
    paperColor('#F4F0E6'),
    contrast(1.5),
  ],
  groups: [
    { id: 'light', ...TONE_TEXT, nodes: TONE_NODES },
    {
      id: 'lines',
      title: 'Lines',
      body:
        'View-space position turned by the line angle; its Y × density through a sine gives ' +
        'parallel waves fixed to the camera. Remap takes them from -1…1 to 0…1.',
      es: {
        title: 'Líneas',
        body: 'La posición en el espacio de la vista, girada por el ángulo; su Y × densidad por un seno da ondas paralelas fijas a la cámara. Remap las lleva de -1…1 a 0…1.',
      },
      nodes: [
        node('viewPosition', 'input/position', {}, { space: 'view' }),
        reader('lineAngle', 'lineAngle'),
        node('turned', 'vector/rotate-2d', { center: vec2(0, 0) }),
        node('turnedAxes', 'vector/split'),
        reader('lineDensity', 'lineDensity'),
        node('linePhase', 'math/multiply'),
        node('lineWave', 'math/sin'),
        node('wave', 'math/remap', { inMin: float(-1), inMax: float(1) }),
      ],
    },
    {
      id: 'ink',
      title: 'Ink',
      body:
        'AA Step inks the wave wherever it rises above the tone: thin lines in the light, thick ' +
        'ones in the shadow, solid ink where the tone falls to 0.',
      es: {
        title: 'Tinta',
        body: 'AA Step entinta la onda donde supera al tono: líneas finas en la luz, gruesas en la sombra, tinta llena donde el tono cae a 0.',
      },
      nodes: [node('inkMask', 'interpolation/aa-step'), ...INK_NODES],
    },
    { id: 'paper', ...PAPER_TEXT, nodes: PAPER_NODES },
  ],
  wires: [
    ...TONE_WIRES,
    ['viewPosition.out', 'turned.in'],
    ['lineAngle.out', 'turned.angle'],
    ['turned.out', 'turnedAxes.in'],
    ['turnedAxes.y', 'linePhase.a'],
    ['lineDensity.out', 'linePhase.b'],
    ['linePhase.out', 'lineWave.in'],
    ['lineWave.out', 'wave.in'],
    [TONE_OUT, 'inkMask.edge'],
    ['wave.out', 'inkMask.in'],
    ...PAPER_WIRES,
    ['inkMask.out', INK_MASK_IN],
    ...INK_WIRES,
  ],
  master: { params: { lighting: 'unlit' } },
}
