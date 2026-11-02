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

/** Lines per unit of view space: about as close as Pencil's hatching. */
const LINE_DENSITY = 32
/** Hatching runs down to the left, the way a right hand shades. */
const HATCH_ANGLE = -0.75
/** The cross-hatching crosses it a little off square, as a hand does. */
const CROSS_ANGLE = 0.95
/** How much darker the tone must get before the cross-hatching starts. */
const CROSS_DELAY = 0.4
/** Ink flow blotches per unit of view space: a wet or dry run spans a few lines. */
const FLOW_SCALE = 12
/** Tooth cells per unit of view space: a grain or two of pixels on the preview's mesh. */
const TOOTH_SCALE = 220
/** Half the distance between two lines: a line this wide fills the gap. */
const HALF_GAP = 0.5
/** Keeps a line's width above 0, so Smoothstep never gets two equal edges in full light. */
const MIN_WIDTH = 0.001
/** Where a ballpoint line's solid core starts to soften, as a share of its width. */
const CORE_SHARE = 0.45

/**
 * Ballpoint pen shading after the pen of Profesora Ya's drawing pencil. There each nib impression
 * is a solid core with a soft edge, a slow Perlin flow widens and darkens it where the ink runs
 * wet, and the paper's tooth leaves pale specks without breaking the line. Here the impressions
 * become hatching and cross-hatching whose width follows the Main Light, with the same flow and
 * tooth in view space.
 */
export const PEN: ExampleSpec = {
  properties: [
    { name: 'lineDensity', label: 'Line density', value: float(LINE_DENSITY) },
    { name: 'hatchAngle', label: 'Hatch angle', value: float(HATCH_ANGLE) },
    { name: 'crossAngle', label: 'Cross-hatch angle', value: float(CROSS_ANGLE) },
    { name: 'crossDelay', label: 'Cross-hatch delay', value: float(CROSS_DELAY) },
    { name: 'wobble', label: 'Wobble', value: float(0.004) },
    { name: 'flowScale', label: 'Ink flow scale', value: float(FLOW_SCALE) },
    { name: 'toothScale', label: 'Tooth scale', value: float(TOOTH_SCALE) },
    { name: 'outline', label: 'Outline', value: float(0.7) },
    inkColor('#1656B8'),
    paperColor('#F7F4EC'),
    contrast(1.8),
  ],
  groups: [
    { id: 'light', ...TONE_TEXT, nodes: TONE_NODES },
    {
      id: 'flow',
      title: 'Ink flow',
      body:
        'A 2D Perlin over view space: where the ballpoint runs wet or dry. Remap and Clamp ' +
        'take it to 0…1; a dry line narrows to 0.68 of its width and pales to 0.7 of its ink.',
      es: {
        title: 'Flujo de tinta',
        body: 'Un Perlin 2D sobre el espacio de la vista: dónde la birome corre húmeda o seca. Remap y Clamp lo llevan a 0…1; una línea seca se angosta a 0.68 de su ancho y se aclara a 0.7 de su tinta.',
      },
      nodes: [
        node('viewPosition', 'input/position', {}, { space: 'view' }),
        reader('flowScale', 'flowScale'),
        node('flowNoise', 'effects/noise', {}, { kind: 'perlin-2d', octaves: 1 }),
        node('flowRemapped', 'math/remap', {
          inMin: float(-1),
          inMax: float(1),
          outMin: float(-0.25),
          outMax: float(1.25),
        }),
        node('flow', 'math/clamp', { min: float(0), max: float(1) }),
        node('flowWidth', 'math/remap', { outMin: float(0.68) }),
        node('flowInk', 'math/remap', { outMin: float(0.7) }),
      ],
    },
    {
      id: 'tooth',
      title: 'Paper tooth',
      body:
        'View-space X and Y cut into cells by Floor, and Random gives each cell a height. ' +
        'Smoothstep and Remap turn the low cells into pale specks: the ink never drops below ' +
        '0.65, so the line stays whole.',
      es: {
        title: 'Diente del papel',
        body: 'La X y la Y de la vista, cortadas en celdas por Floor, y Random le da una altura a cada celda. Smoothstep y Remap convierten las celdas bajas en puntitos claros: la tinta nunca baja de 0.65, así la línea sigue entera.',
      },
      nodes: [
        node('viewAxes', 'vector/split'),
        node('viewPlane', 'vector/combine'),
        reader('toothScale', 'toothScale'),
        node('toothScaled', 'math/multiply'),
        node('toothCells', 'math/floor'),
        node('toothHeight', 'math/hash'),
        node('toothGrip', 'interpolation/smoothstep', { edge0: float(0.1), edge1: float(0.8) }),
        node('toothSpecks', 'math/remap', { outMin: float(0.65) }),
      ],
    },
    {
      id: 'wobble',
      title: 'Hand',
      body:
        'A soft noise over view space, scaled by Wobble: how far a line strays from a ruler. ' +
        'Both hatchings share it, so their lines bend together like one hand drew them.',
      es: {
        title: 'Mano',
        body: 'Un noise suave sobre el espacio de la vista, escalado por Wobble: cuánto se aparta una línea de la regla. Las dos tramas lo comparten, así sus líneas se doblan juntas como si las hiciera una sola mano.',
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
        'View space turned by Hatch angle; its Y plus the wobble, × density, through Fract: ' +
        'how far each point is from the middle of its line. The width grows from 0 in full ' +
        'light to the whole gap in shadow, × the flow width, and a soft-edged core inks it.',
      es: {
        title: 'Rayado',
        body: 'El espacio de la vista girado por Hatch angle; su Y más el temblor, × densidad, por Fract: qué tan lejos está cada punto del centro de su línea. El ancho crece de 0 con luz plena a todo el hueco en la sombra, × el ancho del flujo, y un núcleo de borde suave la entinta.',
      },
      nodes: [
        reader('hatchAngle', 'hatchAngle'),
        node('hatchTurned', 'vector/rotate-2d', { center: vec2(0, 0) }),
        node('hatchAxes', 'vector/split'),
        node('hatchWobbled', 'math/add'),
        reader('hatchDensity', 'lineDensity'),
        node('hatchPhase', 'math/multiply'),
        node('hatchCell', 'math/fract'),
        node('hatchCentered', 'math/subtract', { b: float(HALF_GAP) }),
        node('hatchDistance', 'math/abs'),
        node('hatchShade', 'math/remap', { outMin: float(HALF_GAP), outMax: float(0) }),
        node('hatchFlowed', 'math/multiply'),
        node('hatchWidth', 'math/max', { b: float(MIN_WIDTH) }),
        node('hatchCore', 'math/multiply', { b: float(CORE_SHARE) }),
        node('hatchEdge', 'interpolation/smoothstep'),
        node('hatchLines', 'math/one-minus'),
      ],
    },
    {
      id: 'cross',
      title: 'Cross-hatching',
      body:
        'The same lines at Cross-hatch angle, held back by Cross-hatch delay: they only start ' +
        'once the tone is that much darker, so they cross the hatching in the shadows alone.',
      es: {
        title: 'Rayado cruzado',
        body: 'Las mismas líneas con Cross-hatch angle, frenadas por Cross-hatch delay: solo empiezan cuando el tono es así de más oscuro, así cruzan el rayado nada más que en las sombras.',
      },
      nodes: [
        reader('crossAngle', 'crossAngle'),
        node('crossTurned', 'vector/rotate-2d', { center: vec2(0, 0) }),
        node('crossAxes', 'vector/split'),
        node('crossWobbled', 'math/add'),
        reader('crossDensity', 'lineDensity'),
        node('crossPhase', 'math/multiply'),
        node('crossCell', 'math/fract'),
        node('crossCentered', 'math/subtract', { b: float(HALF_GAP) }),
        node('crossDistance', 'math/abs'),
        reader('crossDelay', 'crossDelay'),
        node('crossTone', 'math/add'),
        node('crossShade', 'math/remap', { outMin: float(HALF_GAP), outMax: float(0) }),
        node('crossFlowed', 'math/multiply'),
        node('crossWidth', 'math/max', { b: float(MIN_WIDTH) }),
        node('crossCore', 'math/multiply', { b: float(CORE_SHARE) }),
        node('crossEdge', 'interpolation/smoothstep'),
        node('crossLines', 'math/one-minus'),
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
      id: 'ink',
      title: 'Ink',
      body:
        'Hatching, cross-hatching and outline add up, × the flow ink and the tooth specks. ' +
        'Clamp holds it to 0…1 and Blend multiplies the ink over the paper by it.',
      es: {
        title: 'Tinta',
        body: 'Rayado, rayado cruzado y contorno se suman, × la tinta del flujo y los puntitos del diente. Clamp lo deja en 0…1 y Blend multiplica la tinta sobre el papel con eso.',
      },
      nodes: [
        node('hatchings', 'math/add'),
        node('strokes', 'math/add'),
        node('flowed', 'math/multiply'),
        node('specked', 'math/multiply'),
        node('coverage', 'math/clamp', { min: float(0), max: float(1) }),
        ...INK_NODES,
      ],
    },
    { id: 'paper', ...PAPER_TEXT, nodes: PAPER_NODES },
  ],
  wires: [
    ...TONE_WIRES,
    // Ink flow
    ['viewPosition.out', 'flowNoise.p'],
    ['flowScale.out', 'flowNoise.scale'],
    ['flowNoise.out', 'flowRemapped.in'],
    ['flowRemapped.out', 'flow.in'],
    ['flow.out', 'flowWidth.in'],
    ['flow.out', 'flowInk.in'],
    // Paper tooth
    ['viewPosition.out', 'viewAxes.in'],
    ['viewAxes.x', 'viewPlane.x'],
    ['viewAxes.y', 'viewPlane.y'],
    ['viewPlane.vec2', 'toothScaled.a'],
    ['toothScale.out', 'toothScaled.b'],
    ['toothScaled.out', 'toothCells.in'],
    ['toothCells.out', 'toothHeight.in'],
    ['toothHeight.out', 'toothGrip.in'],
    ['toothGrip.out', 'toothSpecks.in'],
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
    ['hatchPhase.out', 'hatchCell.in'],
    ['hatchCell.out', 'hatchCentered.a'],
    ['hatchCentered.out', 'hatchDistance.in'],
    [TONE_OUT, 'hatchShade.in'],
    ['hatchShade.out', 'hatchFlowed.a'],
    ['flowWidth.out', 'hatchFlowed.b'],
    ['hatchFlowed.out', 'hatchWidth.a'],
    ['hatchWidth.out', 'hatchCore.a'],
    ['hatchCore.out', 'hatchEdge.edge0'],
    ['hatchWidth.out', 'hatchEdge.edge1'],
    ['hatchDistance.out', 'hatchEdge.in'],
    ['hatchEdge.out', 'hatchLines.in'],
    // Cross-hatching
    ['viewPlane.vec2', 'crossTurned.in'],
    ['crossAngle.out', 'crossTurned.angle'],
    ['crossTurned.out', 'crossAxes.in'],
    ['crossAxes.y', 'crossWobbled.a'],
    ['wobbleOffset.out', 'crossWobbled.b'],
    ['crossWobbled.out', 'crossPhase.a'],
    ['crossDensity.out', 'crossPhase.b'],
    ['crossPhase.out', 'crossCell.in'],
    ['crossCell.out', 'crossCentered.a'],
    ['crossCentered.out', 'crossDistance.in'],
    [TONE_OUT, 'crossTone.a'],
    ['crossDelay.out', 'crossTone.b'],
    ['crossTone.out', 'crossShade.in'],
    ['crossShade.out', 'crossFlowed.a'],
    ['flowWidth.out', 'crossFlowed.b'],
    ['crossFlowed.out', 'crossWidth.a'],
    ['crossWidth.out', 'crossCore.a'],
    ['crossCore.out', 'crossEdge.edge0'],
    ['crossWidth.out', 'crossEdge.edge1'],
    ['crossDistance.out', 'crossEdge.in'],
    ['crossEdge.out', 'crossLines.in'],
    // Outline
    ['outline.out', 'outlineStroke.edge'],
    ['fresnel.out', 'outlineStroke.in'],
    // Ink
    ['hatchLines.out', 'hatchings.a'],
    ['crossLines.out', 'hatchings.b'],
    ['hatchings.out', 'strokes.a'],
    ['outlineStroke.out', 'strokes.b'],
    ['strokes.out', 'flowed.a'],
    ['flowInk.out', 'flowed.b'],
    ['flowed.out', 'specked.a'],
    ['toothSpecks.out', 'specked.b'],
    ['specked.out', 'coverage.in'],
    ...PAPER_WIRES,
    ['coverage.out', INK_MASK_IN],
    ...INK_WIRES,
  ],
  master: { params: { lighting: 'unlit' } },
}
