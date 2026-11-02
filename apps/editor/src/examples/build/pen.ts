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

/** Radians of the hatch wave per unit of view space: a little looser than Pencil's graphite. */
const HATCH_DENSITY = 170
/** Hatching runs down to the left, the way a right hand shades. */
const HATCH_ANGLE = -0.75
/** The cross-hatching crosses it a little off square, as a hand does. */
const CROSS_ANGLE = 0.95
/** How much darker the tone must get before the cross-hatching starts. */
const CROSS_DELAY = 0.35
/** The lowest the lines' edge goes: a ballpoint line only widens so far, so a shadow never floods. */
const WIDEST_LINE = 0.3
/** Ink flow blotches per unit of view space: a wet or dry run spans a few lines. */
const FLOW_SCALE = 12
/** How much a dry run raises the line's edge: the line narrows, as a dry ballpoint's does. */
const DRY_THINNING = 0.12
/** Tooth cells per unit of view space: a grain or two of pixels on the preview's mesh. */
const TOOTH_SCALE = 220
/** The paper tooth pales the ink down to this, never lower, so a line stays whole. */
const TOOTH_INK = 0.65
/** One pass of ink; where two lines cross they add up, darker, until Clamp holds them at 1. */
const INK_DENSITY = 0.72

/**
 * Ballpoint pen shading after the pen of Profesora Ya's drawing pencil, drawn with the Pencil
 * template's strokes. There the pen lays a continuous line whose width and ink follow a slow Perlin
 * flow, wet or dry, and the paper's tooth only leaves pale specks in it; ink is translucent, so a
 * second pass over a line darkens it. Here the same hatching, cross-hatching and contour as Pencil
 * follow the Main Light, but as ballpoint lines: unbroken, thinner and paler where the ink runs dry,
 * and darker where they cross.
 */
export const PEN: ExampleSpec = {
  properties: [
    { name: 'hatchDensity', label: 'Hatch density', value: float(HATCH_DENSITY) },
    { name: 'hatchAngle', label: 'Hatch angle', value: float(HATCH_ANGLE) },
    { name: 'crossAngle', label: 'Cross-hatch angle', value: float(CROSS_ANGLE) },
    { name: 'crossDelay', label: 'Cross-hatch delay', value: float(CROSS_DELAY) },
    { name: 'wobble', label: 'Wobble', value: float(0.004) },
    { name: 'flowScale', label: 'Ink flow scale', value: float(FLOW_SCALE) },
    { name: 'toothScale', label: 'Tooth scale', value: float(TOOTH_SCALE) },
    { name: 'inkDensity', label: 'Ink density', value: float(INK_DENSITY) },
    { name: 'outline', label: 'Outline', value: float(0.8) },
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
        'A 2D Perlin over view space, remapped to 0…1: where the ballpoint runs wet or dry. A dry ' +
        'run lifts the lines’ edge by up to 0.12, so they narrow, and pales the ink to 0.7.',
      es: {
        title: 'Flujo de tinta',
        body: 'Un Perlin 2D sobre el espacio de la vista, reescalado a 0…1: dónde la birome corre húmeda o seca. Una racha seca levanta el borde de las líneas hasta 0.12, así se angostan, y aclara la tinta a 0.7.',
      },
      nodes: [
        node('viewPosition', 'input/position', {}, { space: 'view' }),
        reader('flowScale', 'flowScale'),
        node('flowNoise', 'effects/noise', {}, { kind: 'perlin-2d', octaves: 1 }),
        node('flow', 'math/remap', { inMin: float(-1), inMax: float(1) }),
        node('dryEdge', 'math/remap', { outMin: float(DRY_THINNING), outMax: float(0) }),
        node('flowInk', 'math/remap', { outMin: float(0.7) }),
      ],
    },
    {
      id: 'tooth',
      title: 'Paper tooth',
      body:
        'View-space X and Y cut into cells by Floor, and Random gives each cell a height. ' +
        'Smoothstep and Remap turn the low cells into pale specks: unlike graphite the ink never ' +
        'drops below 0.65, so a line stays whole.',
      es: {
        title: 'Diente del papel',
        body: 'La X y la Y de la vista, cortadas en celdas por Floor, y Random le da una altura a cada celda. Smoothstep y Remap convierten las celdas bajas en puntitos claros: a diferencia del grafito, la tinta nunca baja de 0.65, así la línea sigue entera.',
      },
      nodes: [
        node('viewAxes', 'vector/split'),
        node('viewPlane', 'vector/combine'),
        reader('toothScale', 'toothScale'),
        node('toothScaled', 'math/multiply'),
        node('toothCells', 'math/floor'),
        node('toothHeight', 'math/hash'),
        node('toothGrip', 'interpolation/smoothstep', { edge0: float(0.1), edge1: float(0.8) }),
        node('toothSpecks', 'math/remap', { outMin: float(TOOTH_INK) }),
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
        'View space turned by Hatch angle; its Y plus the wobble, × density through a sine, ' +
        'gives parallel lines. AA Step draws them where the wave rises above the tone and the ' +
        'dry edge: none in full light, wider as the light falls, thinner where the ink runs dry. ' +
        'Max stops the tone at 0.3, so a line never widens past a ballpoint’s and the gaps stay.',
      es: {
        title: 'Rayado',
        body: 'El espacio de la vista girado por Hatch angle; su Y más el temblor, × densidad por un seno, da líneas paralelas. AA Step las dibuja donde la onda supera al tono y al borde seco: ninguna con luz plena, más anchas a medida que cae la luz, más finas donde la tinta corre seca. Max frena el tono en 0.3, así una línea nunca se ensancha más que una de birome y los huecos quedan.',
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
        node('widest', 'math/max', { b: float(WIDEST_LINE) }),
        node('lineEdge', 'math/add'),
        node('hatchLines', 'interpolation/aa-step'),
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
        reader('crossDensity', 'hatchDensity'),
        node('crossPhase', 'math/multiply'),
        node('crossWave', 'math/sin'),
        node('crossRemapped', 'math/remap', { inMin: float(-1), inMax: float(1) }),
        reader('crossDelay', 'crossDelay'),
        node('crossEdge', 'math/add'),
        node('crossLines', 'interpolation/aa-step'),
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
        'Hatching, cross-hatching and outline add up, × Ink density: one pass of translucent ' +
        'ink, so where lines cross they darken as a second pass of a ballpoint does. × the flow ' +
        'ink and the tooth specks, Clamp holds it to 0…1 and Blend multiplies the ink over the ' +
        'paper by it.',
      es: {
        title: 'Tinta',
        body: 'Rayado, rayado cruzado y contorno se suman, × Ink density: una pasada de tinta translúcida, así donde las líneas se cruzan se oscurecen como con una segunda pasada de birome. × la tinta del flujo y los puntitos del diente, Clamp lo deja en 0…1 y Blend multiplica la tinta sobre el papel con eso.',
      },
      nodes: [
        node('hatchings', 'math/add'),
        node('lines', 'math/add'),
        reader('inkDensity', 'inkDensity'),
        node('inkPass', 'math/multiply'),
        node('flowed', 'math/multiply'),
        node('specked', 'math/multiply'),
        node('inkMask', 'math/clamp', { min: float(0), max: float(1) }),
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
    ['flowNoise.out', 'flow.in'],
    ['flow.out', 'dryEdge.in'],
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
    ['hatchPhase.out', 'hatchWave.in'],
    ['hatchWave.out', 'hatchRemapped.in'],
    [TONE_OUT, 'widest.a'],
    ['widest.out', 'lineEdge.a'],
    ['dryEdge.out', 'lineEdge.b'],
    ['lineEdge.out', 'hatchLines.edge'],
    ['hatchRemapped.out', 'hatchLines.in'],
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
    ['lineEdge.out', 'crossEdge.a'],
    ['crossDelay.out', 'crossEdge.b'],
    ['crossEdge.out', 'crossLines.edge'],
    ['crossRemapped.out', 'crossLines.in'],
    // Outline
    ['outline.out', 'outlineStroke.edge'],
    ['fresnel.out', 'outlineStroke.in'],
    // Ink
    ['hatchLines.out', 'hatchings.a'],
    ['crossLines.out', 'hatchings.b'],
    ['hatchings.out', 'lines.a'],
    ['outlineStroke.out', 'lines.b'],
    ['lines.out', 'inkPass.a'],
    ['inkDensity.out', 'inkPass.b'],
    ['inkPass.out', 'flowed.a'],
    ['flowInk.out', 'flowed.b'],
    ['flowed.out', 'specked.a'],
    ['toothSpecks.out', 'specked.b'],
    ['specked.out', 'inkMask.in'],
    ...PAPER_WIRES,
    ['inkMask.out', INK_MASK_IN],
    ...INK_WIRES,
  ],
  master: { params: { lighting: 'unlit' } },
}
