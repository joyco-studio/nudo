import { float } from '@nudo-tsl/core'

import type { CommentText, NodeSpec, PortPath, PropertySpec, WireSpec } from './example-spec'
import { node, reader } from './example-spec'
import { hexColor } from './hex-color'

/**
 * What the hand-drawn templates (Lines, Scribble, Patch) share: a tone from the Main
 * Light that the ink follows, a sheet of grained paper, and the ink laid over it. spite's sketches
 * (github.com/spite/sketch, MIT) shade from the luma of a lit render; a material can't read its
 * own lighting, so the Main Light's half Lambert stands in for it.
 */

/** Ink and paper colors, set per template. */
export const paperColor = (hex: string): PropertySpec => ({
  name: 'paperColor',
  label: 'Paper color',
  value: hexColor(hex),
  widget: 'color',
})

export const inkColor = (hex: string): PropertySpec => ({
  name: 'inkColor',
  label: 'Ink color',
  value: hexColor(hex),
  widget: 'color',
})

/** How hard the tone swings from light to shadow: 1 keeps the light as it is. */
export const contrast = (value: number): PropertySpec => ({
  name: 'contrast',
  label: 'Contrast',
  value: float(value),
})

/** The middle of the tone, which contrast pivots around. */
const TONE_PIVOT = 0.5

export const TONE_TEXT: CommentText & { readonly es: CommentText } = {
  title: 'Light',
  body:
    'Main Light → Half Lambert, squared as Valve shades with it: 1 facing the light, 0.25 ' +
    'edge-on, 0 facing away. Contrast stretches it around 0.5, so the ink reaches the shadows ' +
    'sooner.',
  es: {
    title: 'Luz',
    body: 'Main Light → Half Lambert, al cuadrado como lo usa Valve: 1 de frente a la luz, 0.25 de canto, 0 de espaldas. Contrast lo estira alrededor de 0.5, así la tinta llega antes a las sombras.',
  },
}

export const TONE_NODES: readonly NodeSpec[] = [
  node('mainLight', 'input/main-light'),
  node('lightSquared', 'math/power', { b: float(2) }),
  node('toneCentered', 'math/subtract', { b: float(TONE_PIVOT) }),
  reader('contrast', 'contrast'),
  node('toneStretched', 'math/multiply'),
  node('tone', 'math/add', { b: float(TONE_PIVOT) }),
]

export const TONE_WIRES: readonly WireSpec[] = [
  ['mainLight.halfLambert', 'lightSquared.a'],
  ['lightSquared.out', 'toneCentered.a'],
  ['toneCentered.out', 'toneStretched.a'],
  ['contrast.out', 'toneStretched.b'],
  ['toneStretched.out', 'tone.a'],
]

/** 0 in the deepest shadow, 1 in full light; contrast can push it past either end. */
export const TONE_OUT: PortPath = 'tone.out'

/** Noise scales of the paper: soft clouds of pulp, and the fine tooth a pen catches on. */
const PULP_SCALE = 5
const TOOTH_SCALE = 140
/** The paper's grain darkens the paper color down to this, where both noises are lowest. */
const GRAIN_DARKEST = 0.72

export const PAPER_TEXT: CommentText & { readonly es: CommentText } = {
  title: 'Paper',
  body:
    'Paper made of two noises in view space, so it stays put while the mesh turns: soft ' +
    'clouds of pulp and a fine tooth. Their sum, remapped, darkens the paper color a little.',
  es: {
    title: 'Papel',
    body: 'Papel hecho con dos noise en el espacio de la vista, así queda quieto mientras el mesh gira: nubes suaves de pulpa y un diente fino. Su suma, reescalada, oscurece un poco el color del papel.',
  },
}

export const PAPER_NODES: readonly NodeSpec[] = [
  node('paperPosition', 'input/position', {}, { space: 'view' }),
  node('pulp', 'effects/noise', { scale: float(PULP_SCALE) }, { kind: 'simplex', octaves: 4 }),
  node('tooth', 'effects/noise', { scale: float(TOOTH_SCALE) }, { kind: 'simplex', octaves: 2 }),
  node('paperNoise', 'math/add'),
  node('grain', 'math/remap', {
    inMin: float(-1.5),
    inMax: float(1.5),
    outMin: float(GRAIN_DARKEST),
  }),
  reader('paperColor', 'paperColor'),
  node('paper', 'math/multiply'),
]

export const PAPER_WIRES: readonly WireSpec[] = [
  ['paperPosition.out', 'pulp.p'],
  ['paperPosition.out', 'tooth.p'],
  ['pulp.out', 'paperNoise.a'],
  ['tooth.out', 'paperNoise.b'],
  ['paperNoise.out', 'grain.in'],
  ['paperColor.out', 'paper.a'],
  ['grain.out', 'paper.b'],
]

/**
 * The ink: multiplied over the paper where `mask` is 1, so the grain shows through it as it does
 * through real ink. Wire the template's 0..1 ink mask into `inked.opacity`.
 */
export const INK_NODES: readonly NodeSpec[] = [
  reader('inkColor', 'inkColor'),
  node('inked', 'color/blend', {}, { mode: 'multiply' }),
]

export const INK_WIRES: readonly WireSpec[] = [
  ['paper.out', 'inked.base'],
  ['inkColor.out', 'inked.blend'],
  ['inked.out', 'master.baseColor'],
]

export const INK_MASK_IN: PortPath = 'inked.opacity'
