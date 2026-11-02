import { float, vec2 } from '@nudo-tsl/core'

import type { ExampleSpec, PropertySpec } from './example-spec'
import { node, reader } from './example-spec'
import { hexColor } from './hex-color'
import {
  PAPER_NODES,
  PAPER_TEXT,
  PAPER_WIRES,
  TONE_NODES,
  TONE_OUT,
  TONE_TEXT,
  TONE_WIRES,
  contrast,
  paperColor,
} from './sketch-paper'

/** Radians of the hatch wave per unit of view space: a little looser than Lines' ink. */
const HATCH_DENSITY = 200
/** Hatching runs down to the left, the way a right hand shades. */
const HATCH_ANGLE = -0.75
/** The cross-hatching crosses it a little off square, as a hand does. */
const CROSS_ANGLE = 0.95
/** How much darker the tone must get before the cross-hatching starts. */
const CROSS_DELAY = 0.4
/** Tooth cells per unit of view space: a grain or two of pixels on the preview's mesh. */
const TOOTH_SCALE = 220
/** The coarse tooth clusters three by three fine cells, as the pencil's coarse grain does. */
const COARSE_TOOTH = 1 / 3

const graphiteColor: PropertySpec = {
  name: 'graphiteColor',
  label: 'Graphite color',
  value: hexColor('#37342E'),
  widget: 'color',
}

/**
 * Graphite pencil shading after the drawing pencil of Profesora Ya: soft graphite that only
 * catches on the paper's raised tooth, so a stroke is broken into grain and every pass over the
 * same spot fills more of it. There the tooth is a hash of paper-space cells at two sizes and each
 * nib impression is masked by it; here the impressions become hatching and cross-hatching that
 * follow the Main Light, and the same two-size tooth masks them in view space.
 */
export const PENCIL: ExampleSpec = {
  properties: [
    { name: 'hatchDensity', label: 'Hatch density', value: float(HATCH_DENSITY) },
    { name: 'hatchAngle', label: 'Hatch angle', value: float(HATCH_ANGLE) },
    { name: 'crossAngle', label: 'Cross-hatch angle', value: float(CROSS_ANGLE) },
    { name: 'crossDelay', label: 'Cross-hatch delay', value: float(CROSS_DELAY) },
    { name: 'wobble', label: 'Wobble', value: float(0.004) },
    { name: 'toothScale', label: 'Tooth scale', value: float(TOOTH_SCALE) },
    { name: 'pressure', label: 'Pressure', value: float(1.2) },
    { name: 'outline', label: 'Outline', value: float(0.7) },
    graphiteColor,
    paperColor('#F7F4EC'),
    contrast(1.8),
  ],
  groups: [
    { id: 'light', ...TONE_TEXT, nodes: TONE_NODES },
    {
      id: 'tooth',
      title: 'Paper tooth',
      body:
        'View-space X and Y cut into cells by Floor, and Random gives each cell a height: the ' +
        'fine tooth, and a coarse one three cells wide. Smoothstep keeps the high fine cells and ' +
        'the coarse one varies them, so graphite only catches on part of the sheet.',
      es: {
        title: 'Diente del papel',
        body: 'La X y la Y de la vista, cortadas en celdas por Floor, y Random le da una altura a cada celda: el diente fino y uno grueso de tres celdas. Smoothstep se queda con las celdas finas altas y el grueso las varía, así el grafito solo agarra en parte de la hoja.',
      },
      nodes: [
        node('viewPosition', 'input/position', {}, { space: 'view' }),
        node('viewAxes', 'vector/split'),
        node('viewPlane', 'vector/combine'),
        reader('toothScale', 'toothScale'),
        node('fineScaled', 'math/multiply'),
        node('fineCells', 'math/floor'),
        node('fineTooth', 'math/hash'),
        node('coarseScaled', 'math/multiply', { b: float(COARSE_TOOTH) }),
        node('coarseCells', 'math/floor'),
        node('coarseTooth', 'math/hash', { seed: float(1) }),
        node('fineGrip', 'interpolation/smoothstep', { edge0: float(0.05), edge1: float(0.7) }),
        node('coarseGrip', 'math/remap', { outMin: float(0.4) }),
        node('toothHeight', 'math/multiply'),
      ],
    },
    {
      id: 'wobble',
      title: 'Hand',
      body:
        'A soft noise over view space, scaled by Wobble: how far a stroke strays from a ruler ' +
        'line. Both hatchings share it, so their lines bend together like one hand drew them.',
      es: {
        title: 'Mano',
        body: 'Un noise suave sobre el espacio de la vista, escalado por Wobble: cuánto se aparta un trazo de la regla. Las dos tramas lo comparten, así sus líneas se doblan juntas como si las hiciera una sola mano.',
      },
      nodes: [
        node('wobbleNoise', 'effects/noise', { scale: float(6) }, { kind: 'simplex', octaves: 2 }),
        reader('wobble', 'wobble'),
        node('wobbleOffset', 'math/multiply'),
      ],
    },
    {
      id: 'hatch',
      title: 'Hatching',
      body:
        'View space turned by Hatch angle; its Y plus the wobble, × density through a sine, ' +
        'gives parallel strokes. AA Step draws them where the wave rises above the tone: none ' +
        'in full light, wider as the light falls.',
      es: {
        title: 'Rayado',
        body: 'El espacio de la vista girado por Hatch angle; su Y más el temblor, × densidad por un seno, da trazos paralelos. AA Step los dibuja donde la onda supera al tono: ninguno con luz plena, más anchos a medida que cae la luz.',
      },
      nodes: [
        reader('hatchAngle', 'hatchAngle'),
        node('hatchTurned', 'vector/rotate-2d', { center: vec2(0, 0) }),
        node('hatchAxes', 'vector/split'),
        node('hatchWobbled', 'math/add'),
        reader('hatchDensity', 'hatchDensity'),
        node('hatchPhase', 'math/multiply'),
        node('hatchWave', 'math/sin'),
        node('hatchRemapped', 'math/remap', { inMin: float(-1), inMax: float(1) }),
        node('hatchStrokes', 'interpolation/aa-step'),
      ],
    },
    {
      id: 'cross',
      title: 'Cross-hatching',
      body:
        'The same strokes at Cross-hatch angle, held back by Cross-hatch delay: they only start ' +
        'once the tone is that much darker, so they cross the hatching in the shadows alone.',
      es: {
        title: 'Rayado cruzado',
        body: 'Los mismos trazos con Cross-hatch angle, frenados por Cross-hatch delay: solo empiezan cuando el tono es así de más oscuro, así cruzan el rayado nada más que en las sombras.',
      },
      nodes: [
        reader('crossAngle', 'crossAngle'),
        node('crossTurned', 'vector/rotate-2d', { center: vec2(0, 0) }),
        node('crossAxes', 'vector/split'),
        node('crossWobbled', 'math/add'),
        reader('crossDensity', 'hatchDensity'),
        node('crossPhase', 'math/multiply'),
        node('crossWave', 'math/sin'),
        node('crossRemapped', 'math/remap', { inMin: float(-1), inMax: float(1) }),
        reader('crossDelay', 'crossDelay'),
        node('crossEdge', 'math/add'),
        node('crossStrokes', 'interpolation/aa-step'),
      ],
    },
    {
      id: 'outline',
      title: 'Outline',
      body:
        'Fresnel grows toward the edges that turn away from you; AA Step cuts it into a contour ' +
        'line. Raise Outline to thin it.',
      es: {
        title: 'Contorno',
        body: 'Fresnel crece hacia los bordes que se alejan de vos; AA Step lo corta en una línea de contorno. Subí Outline para afinarla.',
      },
      nodes: [
        node('fresnel', 'effects/fresnel', { power: float(1) }),
        reader('outline', 'outline'),
        node('outlineStroke', 'interpolation/aa-step'),
      ],
    },
    {
      id: 'graphite',
      title: 'Graphite',
      body:
        'Hatching, cross-hatching and outline add up, × Pressure, and the tooth keeps only the ' +
        'grain they land on: harder pressure, or strokes crossing, fill more of it, as a second ' +
        'pass of a pencil does. Clamp holds it to 0…1 and Blend multiplies the graphite over the ' +
        'paper by it.',
      es: {
        title: 'Grafito',
        body: 'Rayado, rayado cruzado y contorno se suman, × Pressure, y el diente se queda solo con el grano donde caen: más presión, o trazos que se cruzan, llenan más grano, como con una segunda pasada de lápiz. Clamp lo deja en 0…1 y Blend multiplica el grafito sobre el papel con eso.',
      },
      nodes: [
        node('hatchings', 'math/add'),
        node('strokes', 'math/add'),
        reader('pressure', 'pressure'),
        node('pressed', 'math/multiply'),
        node('onTooth', 'math/multiply'),
        node('coverage', 'math/clamp', { min: float(0), max: float(1) }),
        reader('graphiteColor', 'graphiteColor'),
        node('drawn', 'color/blend', {}, { mode: 'multiply' }),
      ],
    },
    { id: 'paper', ...PAPER_TEXT, nodes: PAPER_NODES },
  ],
  wires: [
    ...TONE_WIRES,
    // Paper tooth
    ['viewPosition.out', 'viewAxes.in'],
    ['viewAxes.x', 'viewPlane.x'],
    ['viewAxes.y', 'viewPlane.y'],
    ['viewPlane.vec2', 'fineScaled.a'],
    ['toothScale.out', 'fineScaled.b'],
    ['fineScaled.out', 'fineCells.in'],
    ['fineCells.out', 'fineTooth.in'],
    ['fineScaled.out', 'coarseScaled.a'],
    ['coarseScaled.out', 'coarseCells.in'],
    ['coarseCells.out', 'coarseTooth.in'],
    ['fineTooth.out', 'fineGrip.in'],
    ['coarseTooth.out', 'coarseGrip.in'],
    ['fineGrip.out', 'toothHeight.a'],
    ['coarseGrip.out', 'toothHeight.b'],
    // Hand
    ['viewPosition.out', 'wobbleNoise.p'],
    ['wobbleNoise.out', 'wobbleOffset.a'],
    ['wobble.out', 'wobbleOffset.b'],
    // Hatching
    ['viewPlane.vec2', 'hatchTurned.in'],
    ['hatchAngle.out', 'hatchTurned.angle'],
    ['hatchTurned.out', 'hatchAxes.in'],
    ['hatchAxes.y', 'hatchWobbled.a'],
    ['wobbleOffset.out', 'hatchWobbled.b'],
    ['hatchWobbled.out', 'hatchPhase.a'],
    ['hatchDensity.out', 'hatchPhase.b'],
    ['hatchPhase.out', 'hatchWave.in'],
    ['hatchWave.out', 'hatchRemapped.in'],
    [TONE_OUT, 'hatchStrokes.edge'],
    ['hatchRemapped.out', 'hatchStrokes.in'],
    // Cross-hatching
    ['viewPlane.vec2', 'crossTurned.in'],
    ['crossAngle.out', 'crossTurned.angle'],
    ['crossTurned.out', 'crossAxes.in'],
    ['crossAxes.y', 'crossWobbled.a'],
    ['wobbleOffset.out', 'crossWobbled.b'],
    ['crossWobbled.out', 'crossPhase.a'],
    ['crossDensity.out', 'crossPhase.b'],
    ['crossPhase.out', 'crossWave.in'],
    ['crossWave.out', 'crossRemapped.in'],
    [TONE_OUT, 'crossEdge.a'],
    ['crossDelay.out', 'crossEdge.b'],
    ['crossEdge.out', 'crossStrokes.edge'],
    ['crossRemapped.out', 'crossStrokes.in'],
    // Outline
    ['outline.out', 'outlineStroke.edge'],
    ['fresnel.out', 'outlineStroke.in'],
    // Graphite
    ['hatchStrokes.out', 'hatchings.a'],
    ['crossStrokes.out', 'hatchings.b'],
    ['hatchings.out', 'strokes.a'],
    ['outlineStroke.out', 'strokes.b'],
    ['strokes.out', 'pressed.a'],
    ['pressure.out', 'pressed.b'],
    ['pressed.out', 'onTooth.a'],
    ['toothHeight.out', 'onTooth.b'],
    ['onTooth.out', 'coverage.in'],
    ...PAPER_WIRES,
    ['paper.out', 'drawn.base'],
    ['graphiteColor.out', 'drawn.blend'],
    ['coverage.out', 'drawn.opacity'],
    ['drawn.out', 'master.baseColor'],
  ],
  master: { params: { lighting: 'unlit' } },
}
