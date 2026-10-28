import { float, vec2 } from '@nudo-tsl/core'

import type { ExampleSpec, NodeSpec, PropertySpec, WireSpec } from './example-spec'
import { node, reader } from './example-spec'
import { hexColor } from './hex-color'

/**
 * The illustrated pond water of joyco-studio/lettra-landing (`src/lib/scenes/models/water.ts`,
 * tuned by `src/lib/studio/tools/pond.json`), rebuilt from nudo nodes. Where the reference reads
 * an authored Voronoi sheet and a noise sheet, this graph computes Voronoi and simplex noise; the
 * crease between rosettes comes from the Voronoi edge (F2 − F1) instead of a blurred mip read.
 * The interactive ripples are a simulation, not a shader, and stay out.
 */

/** Pond units across the mesh UV; the reference camera sees about 8.5 units of water. */
const POND_SIZE = 13
/** `motion.scale`: pond units to pattern units. */
const PATTERN_SCALE = 0.81
/** `motion.waveScale` times each ripple read's own scale. */
const NOISE_A_SCALE = 0.97
const NOISE_B_SCALE: readonly [number, number] = [-0.73, 0.8]
/** Each ripple read's scroll per second of wave time, in its own noise space. */
const NOISE_A_SCROLL: readonly [number, number] = [0.04006, 0.02465]
const NOISE_B_SCROLL: readonly [number, number] = [-0.006, 0.012]
/** `motion.waveAmp`, and `motion.causticWobble` + 1 for the rosettes' stronger bend. */
const WAVE_AMP = 0.185
const ROSETTE_WOBBLE = 1.7
/**
 * The authored sheet stores F1 normalized to its cells; computed F1 spans less, so it is scaled up
 * to read the reference's thresholds unchanged.
 */
const F1_GAIN = 1.65
const ROSETTE_RADIUS = 0.8
const BUMP_FREQUENCY = 7.4
const BUMP_DEPTH = 0.33
/** The crease between rosettes: how steeply it rises off a cell edge (F2 − F1), and its offset. */
const CREASE_SHARPNESS = 4
const CREASE_OFFSET = 0.15
/** The bump sheet keeps the computed F1 scale: its bumps stay small and round. */
const BUMP_GAIN = 1
const STAMP_RADIUS = 0.55 / F1_GAIN
const STAMP_FREQUENCIES = { a: 3.65, b: 5, c: 1.95 } as const
/** The reference's two stamp rotations, (0.8, 0.6) and (0.6, 0.8), in radians. */
const STAMP_ROTATIONS = { b: -0.6435, c: 0.9273 } as const
const LIGHT_POSITION: readonly [number, number] = [8, -5]
const DEGREES_TO_RADIANS = Math.PI / 180
const BAND_WIDTH = 8
const BAND_LENGTH = 3.5
const BAND_GLOW = 0.76
const AMBIENT_LIGHT = 0.05
/** `light.ambientGradient` × 0.05: light rises a little toward the right. */
const AMBIENT_GRADIENT = 0.021
/** `light.midLight`: below it a tone blends shade to mid, above it mid to sun. */
const MID_LIGHT = 0.3
const THIN_STAMPS = 1.88
/**
 * The darkness before stamps and sun, and how far the slow noise moves it. Lower than the
 * reference's bias of 2: its noise sheet sits brighter than simplex noise.
 */
const DARKNESS_BIAS = 1
const DARKNESS_VARIATION = 2
/** `lace.breath` × 0.02 per unit of focus; the focus here sums two reads, so half of it. */
const LACE_BREATH = 0.0175
const LACE_WIDEN = 0.1
const LACE_BITE = 0.132
const LACE_WIDTH = -0.13
const LACE_CORE = -0.028
/** The edge darkening: how far it reaches, and linear light for the reference's sRGB half. */
const VIGNETTE_STRENGTH = 0.4457
const VIGNETTE_DARKEN = 0.214

type Tone = 'rim' | 'fill' | 'stamp1' | 'stamp2' | 'stamp3' | 'lace' | 'laceCore'
type Light = 'Shade' | 'Mid' | 'Sun'

/** `palette` in pond.json: each tone in shade, at mid light and in full sun. */
const PALETTE: Readonly<Record<Tone, Readonly<Record<Light, string>>>> = {
  rim: { Shade: '#0E7847', Mid: '#23924C', Sun: '#B4C958' },
  fill: { Shade: '#056646', Mid: '#12814A', Sun: '#97BC53' },
  stamp1: { Shade: '#045842', Mid: '#08724A', Sun: '#6CAD4F' },
  stamp2: { Shade: '#044D3E', Mid: '#086444', Sun: '#4A9F4C' },
  stamp3: { Shade: '#084336', Mid: '#075A40', Sun: '#2E924A' },
  lace: { Shade: '#0E7847', Mid: '#459F4C', Sun: '#C8D05D' },
  laceCore: { Shade: '#418E45', Mid: '#8FBC52', Sun: '#F9F2BC' },
}

const TONE_LABELS: Readonly<Record<Tone, string>> = {
  rim: 'Rim',
  fill: 'Fill',
  stamp1: 'Stamp 1',
  stamp2: 'Stamp 2',
  stamp3: 'Stamp 3',
  lace: 'Lace',
  laceCore: 'Lace core',
}

const TONES = Object.keys(PALETTE).filter((tone): tone is Tone => tone in PALETTE)
const LIGHTS: readonly Light[] = ['Shade', 'Mid', 'Sun']

const paletteProperties = TONES.flatMap((tone) =>
  LIGHTS.map((light): PropertySpec => ({
    name: `${tone}${light}`,
    label: `${TONE_LABELS[tone]} · ${light.toLowerCase()}`,
    value: hexColor(PALETTE[tone][light]),
    widget: 'color',
  })),
)

/** A tone at the current light: Select between its shade-to-mid and mid-to-sun blends. */
function toneNodes(tone: Tone): readonly NodeSpec[] {
  return [
    ...LIGHTS.map((light) => reader(`${tone}${light}`, `${tone}${light}`)),
    node(`${tone}Low`, 'interpolation/lerp', {}, { showPreview: false }),
    node(`${tone}High`, 'interpolation/lerp', {}, { showPreview: false }),
    node(`${tone}Tone`, 'logic/select', { b: float(MID_LIGHT) }, { op: 'lt' }),
  ]
}

function toneWires(tone: Tone): readonly WireSpec[] {
  return [
    [`${tone}Shade.out`, `${tone}Low.a`],
    [`${tone}Mid.out`, `${tone}Low.b`],
    ['toneLow.out', `${tone}Low.t`],
    [`${tone}Mid.out`, `${tone}High.a`],
    [`${tone}Sun.out`, `${tone}High.b`],
    ['toneHigh.out', `${tone}High.t`],
    ['sun.out', `${tone}Tone.a`],
    [`${tone}Low.out`, `${tone}Tone.whenTrue`],
    [`${tone}High.out`, `${tone}Tone.whenFalse`],
  ]
}

export const LETTRA_POND: ExampleSpec = {
  properties: [
    { name: 'waveSpeed', label: 'Wave speed', value: float(2.15) },
    { name: 'lightAngle', label: 'Light angle', value: float(-84) },
    { name: 'lightStrength', label: 'Light strength', value: float(1.2) },
    ...paletteProperties,
  ],
  groups: [
    {
      id: 'pond-space',
      title: 'Pond space',
      es: {
        title: 'Espacio del estanque',
        body: 'El UV de la malla en unidades del estanque, con +y hacia abajo como en la referencia. p es el espacio del patrón que leen todas las capas.',
      },
      body:
        'The mesh UV in pond units, +y toward the bottom like the reference. p is the pattern ' +
        'space every layer reads.',
      nodes: [
        node('uv', 'input/uv'),
        node('centered', 'math/subtract', { b: float(0.5) }),
        node('world', 'math/multiply', { b: vec2(POND_SIZE, -POND_SIZE) }),
        node('p', 'math/multiply', { b: float(PATTERN_SCALE) }),
      ],
    },
    {
      id: 'refraction',
      title: 'Refraction',
      es: {
        title: 'Refracción',
        body: 'Dos lecturas de noise se desplazan, cada una a su velocidad y ángulo. Juntas dan un único desvío que dobla todas las capas igual, así el patrón se mece como agua. Su suma es el foco que hace respirar al encaje.',
      },
      body:
        'Two noise reads scroll at their own speed and angle. Together they give one offset that ' +
        'bends every layer the same way, so the whole pattern sways like water. Their sum is the ' +
        'focus that makes the lace breathe.',
      nodes: [
        node('time', 'input/time'),
        reader('waveSpeed', 'waveSpeed'),
        node('waveTime', 'math/multiply'),
        node('scrollA', 'math/multiply', { b: vec2(...NOISE_A_SCROLL) }),
        node('noiseAt', 'math/add'),
        node('noiseA', 'effects/noise', { scale: float(NOISE_A_SCALE) }, { kind: 'simplex' }),
        node('turnedB', 'math/multiply', { b: vec2(...NOISE_B_SCALE) }),
        node('scrollB', 'math/multiply', { b: vec2(...NOISE_B_SCROLL) }),
        node('noiseBt', 'math/add'),
        node('noiseB', 'effects/noise', { scale: float(1) }, { kind: 'simplex' }),
        node('offset', 'vector/combine'),
        node('ambient', 'math/multiply', { b: float(WAVE_AMP) }),
        node('pf', 'math/add'),
        node('wobble', 'math/multiply', { b: float(ROSETTE_WOBBLE) }),
        node('pl', 'math/add'),
        node('focus', 'math/add'),
      ],
    },
    {
      id: 'rosettes',
      title: 'Rosettes',
      es: {
        title: 'Rosetas',
        body: 'El F1 de Voronoi forma un disco redondo alrededor del centro de cada celda; un Voronoi más fino festonea el borde con bultos. Donde dos rosetas se tocan, el borde de celda (F2 − F1) corta un pliegue fino. depth es qué tan adentro de una roseta está un punto.',
      },
      body:
        'Voronoi F1 grows a round disc around each cell center; a finer Voronoi scallops the rim ' +
        'with bumps. Where two rosettes touch, the cell edge (F2 − F1) cuts a thin crease. depth ' +
        'is how far inside a rosette a point lies.',
      nodes: [
        node('cells', 'effects/voronoi', { scale: float(1) }),
        node('bumpCells', 'effects/voronoi', { scale: float(BUMP_FREQUENCY) }),
        node('roseCore', 'math/remap', {
          outMin: float(ROSETTE_RADIUS),
          outMax: float(ROSETTE_RADIUS - F1_GAIN),
        }),
        node('roseBumps', 'math/remap', {
          outMin: float(0.25 * BUMP_DEPTH),
          outMax: float((0.25 - BUMP_GAIN) * BUMP_DEPTH),
        }),
        node('rosette', 'math/add'),
        node('crease', 'math/remap', {
          outMin: float(-CREASE_OFFSET),
          outMax: float(CREASE_SHARPNESS - CREASE_OFFSET),
        }),
        node('depth', 'math/min'),
      ],
    },
    {
      id: 'light-direction',
      title: 'Light direction',
      es: {
        title: 'Dirección de la luz',
        body: 'El ángulo de la luz, en grados, como dirección, y la dirección que la cruza.',
      },
      body: 'The light angle, in degrees, as a direction, and the direction across it.',
      nodes: [
        reader('lightAngle', 'lightAngle'),
        node('radians', 'math/multiply', { b: float(DEGREES_TO_RADIANS) }),
        node('sinAngle', 'math/sin'),
        node('cosAngle', 'math/cos'),
        node('lightDir', 'vector/combine'),
        node('negCos', 'math/multiply', { b: float(-1) }),
        node('acrossDir', 'vector/combine'),
      ],
    },
    {
      id: 'sun-band',
      title: 'Sun band',
      es: {
        title: 'Banda de sol',
        body: 'Una banda larga de luz: un núcleo gaussiano nítido (Exp de −x²) más un brillo ancho y suave a través de la dirección de la luz, más fuerte donde entra y apagándose a lo largo. Un leve degradado de izquierda a derecha evita que la sombra quede plana.',
      },
      body:
        'A long band of light: a sharp Gaussian core (Exp of −x²) plus a wide soft glow across ' +
        'the light direction, strongest where it enters and fading along it. A slight ' +
        'left-to-right gradient keeps the shade from going flat.',
      nodes: [
        node('fromLight', 'math/subtract', { b: vec2(...LIGHT_POSITION) }),
        node('across', 'vector/dot'),
        node('acrossN', 'math/divide', { b: float(BAND_WIDTH) }),
        node('across2', 'math/multiply'),
        node('coreArg', 'math/multiply', { b: float(-1) }),
        node('core', 'math/exp'),
        node('glowArg', 'math/multiply', { b: float(-0.08) }),
        node('glowExp', 'math/exp'),
        node('glow', 'math/multiply', { b: float(BAND_GLOW) }),
        node('profile', 'math/add'),
        node('along', 'vector/dot'),
        node('alongN', 'math/divide', { b: float(BAND_LENGTH) }),
        node('ahead', 'math/max', { b: float(0) }),
        node('fadeArg', 'math/multiply', { b: float(-1) }),
        node('fade', 'math/exp'),
        node('entry', 'interpolation/smoothstep', { edge0: float(-1.5), edge1: float(0) }),
        node('faded', 'math/multiply'),
        node('band', 'math/multiply'),
        reader('lightStrength', 'lightStrength'),
        node('bandLit', 'math/multiply'),
        node('worldSplit', 'vector/split'),
        node('gradient', 'math/remap', {
          outMin: float(AMBIENT_LIGHT),
          outMax: float(AMBIENT_LIGHT + AMBIENT_GRADIENT),
        }),
        node('sunRaw', 'math/add'),
        node('sun', 'math/clamp'),
      ],
    },
    {
      id: 'stamps',
      title: 'Stamps',
      es: {
        title: 'Sellos',
        body: 'Tres lecturas más de Voronoi, a otras escalas y dos de ellas rotadas, cortadas en manchas redondas con AA Step. Su cantidad, solo dentro de las rosetas, oscurece el agua.',
      },
      body:
        'Three more Voronoi reads, at other scales and two of them rotated, cut into round dabs ' +
        'with AA Step. Their count, only inside the rosettes, darkens the water.',
      nodes: [
        node('inside', 'interpolation/smoothstep', { edge0: float(0.01), edge1: float(0.05) }),
        node('stampCellsA', 'effects/voronoi', { scale: float(STAMP_FREQUENCIES.a) }),
        node('turnB', 'vector/rotate-2d', { angle: float(STAMP_ROTATIONS.b) }),
        node('stampCellsB', 'effects/voronoi', { scale: float(STAMP_FREQUENCIES.b) }),
        node('turnC', 'vector/rotate-2d', { angle: float(STAMP_ROTATIONS.c) }),
        node('stampCellsC', 'effects/voronoi', { scale: float(STAMP_FREQUENCIES.c) }),
        node('outsideA', 'interpolation/aa-step', { edge: float(STAMP_RADIUS) }),
        node('outsideB', 'interpolation/aa-step', { edge: float(STAMP_RADIUS) }),
        node('outsideC', 'interpolation/aa-step', { edge: float(STAMP_RADIUS) }),
        node('outsideAB', 'math/add'),
        node('outsideABC', 'math/add'),
        node('stampsHit', 'math/subtract', { a: float(3) }),
        node('stampCount', 'math/multiply'),
      ],
    },
    {
      id: 'darkness',
      title: 'Darkness',
      es: {
        title: 'Oscuridad',
        body: 'La cantidad de sellos más un noise lento, aclarada por el sol. Cada umbral de AA Step pasa al tono siguiente, más oscuro.',
      },
      body:
        'The stamp count plus a slow noise, thinned out by the sun. Each AA Step threshold moves ' +
        'to the next, darker tone.',
      nodes: [
        node('variationNoise', 'effects/noise', { scale: float(0.05) }, { kind: 'simplex' }),
        node('variation', 'math/remap', {
          inMin: float(-1),
          outMin: float(DARKNESS_BIAS - DARKNESS_VARIATION),
          outMax: float(DARKNESS_BIAS + DARKNESS_VARIATION),
        }),
        node('stacked', 'math/add'),
        node('sunThin', 'math/multiply', { b: float(THIN_STAMPS) }),
        node('darkness', 'math/subtract'),
        node('toFill', 'interpolation/aa-step', { edge: float(-0.5) }),
        node('toStamps', 'interpolation/aa-step', { edge: float(0.5) }),
        node('toStamp2', 'interpolation/aa-step', { edge: float(1.5) }),
        node('toStamp3', 'interpolation/aa-step', { edge: float(2.5) }),
      ],
    },
    {
      id: 'lace',
      title: 'Lace',
      es: {
        title: 'Encaje',
        body: 'El agua abierta entre rosetas y los pliegues donde se tocan, como máscaras nítidas. El encaje respira con el foco de la refracción, se ensancha bajo el sol y los sellos lo muerden.',
      },
      body:
        'The open water between rosettes and the creases where they touch, as crisp masks. The ' +
        'lace breathes with the refraction focus, widens under the sun and gets bitten by stamps.',
      nodes: [
        node('breath', 'math/multiply', { b: float(LACE_BREATH) }),
        node('widen', 'math/multiply', { b: float(LACE_WIDEN) }),
        node('touching', 'math/clamp'),
        node('bite', 'math/multiply', { b: float(LACE_BITE) }),
        node('growing', 'math/add'),
        node('grow', 'math/subtract'),
        node('laceEdge', 'math/add', { b: float(LACE_WIDTH) }),
        node('laceStep', 'interpolation/aa-step'),
        node('laceMask', 'math/one-minus'),
        node('coreEdge', 'math/add', { b: float(LACE_CORE) }),
        node('coreStep', 'interpolation/aa-step'),
        node('coreMask', 'math/one-minus'),
      ],
    },
    {
      id: 'tones',
      title: 'Tones',
      es: {
        title: 'Tonos',
        body: 'Cada tono mezcla sus colores de sombra, medio y sol según la luz. Select toma la mezcla de sombra a medio por debajo de la luz media (0.3) y la de medio a sol por encima.',
      },
      body:
        'Each tone blends its shade, mid and sun colors by the light. Select takes the ' +
        'shade-to-mid blend below the mid light (0.3) and the mid-to-sun blend above it.',
      nodes: [
        node('toneLow', 'math/divide', { b: float(MID_LIGHT) }),
        node('toneHigh', 'math/remap', { inMin: float(MID_LIGHT) }),
        ...TONES.flatMap(toneNodes),
      ],
    },
    {
      id: 'body',
      title: 'Body and lace',
      es: {
        title: 'Cuerpo y encaje',
        body: 'Tonos planos pintados, del más claro al más oscuro según los umbrales de oscuridad, y encima el encaje y su núcleo, en capas con Lerp.',
      },
      body:
        'Flat painted tones, lightest to darkest by the darkness thresholds, then the lace and its ' +
        'core layered over them with Lerp.',
      nodes: [
        node('rimFill', 'interpolation/lerp'),
        node('spots12', 'interpolation/lerp'),
        node('spots', 'interpolation/lerp'),
        node('body', 'interpolation/lerp'),
        node('withLace', 'interpolation/lerp'),
        node('withCore', 'interpolation/lerp'),
      ],
    },
    {
      id: 'vignette',
      title: 'Vignette',
      es: {
        title: 'Viñeta',
        body: 'El estanque se hace más profundo y oscuro hacia los bordes de la vista, en espacio de pantalla.',
      },
      body: 'The pond deepens and darkens toward the edges of the view, in screen space.',
      nodes: [
        node('screenUv', 'input/screen-uv'),
        node('screenCentered', 'math/subtract', { b: float(0.5) }),
        node('screenStretched', 'math/multiply', { b: vec2(1.4375, 1.15) }),
        node('screenDistance', 'vector/length'),
        node('edgeFade', 'interpolation/smoothstep', { edge0: float(0.32), edge1: float(0.95) }),
        node('vignette', 'math/multiply', { b: float(VIGNETTE_STRENGTH) }),
        node('darkened', 'math/multiply', { b: float(VIGNETTE_DARKEN) }),
        node('final', 'interpolation/lerp'),
      ],
    },
  ],
  wires: [
    // Pond space
    ['uv.out', 'centered.a'],
    ['centered.out', 'world.a'],
    ['world.out', 'p.a'],
    // Refraction
    ['time.out', 'waveTime.a'],
    ['waveSpeed.out', 'waveTime.b'],
    ['waveTime.out', 'scrollA.a'],
    ['p.out', 'noiseAt.a'],
    ['scrollA.out', 'noiseAt.b'],
    ['noiseAt.out', 'noiseA.p'],
    ['p.out', 'turnedB.a'],
    ['waveTime.out', 'scrollB.a'],
    ['turnedB.out', 'noiseBt.a'],
    ['scrollB.out', 'noiseBt.b'],
    ['noiseBt.out', 'noiseB.p'],
    ['noiseA.out', 'offset.x'],
    ['noiseB.out', 'offset.y'],
    ['offset.vec2', 'ambient.a'],
    ['p.out', 'pf.a'],
    ['ambient.out', 'pf.b'],
    ['ambient.out', 'wobble.a'],
    ['p.out', 'pl.a'],
    ['wobble.out', 'pl.b'],
    ['noiseA.out', 'focus.a'],
    ['noiseB.out', 'focus.b'],
    // Rosettes
    ['pl.out', 'cells.uv'],
    ['pl.out', 'bumpCells.uv'],
    ['cells.f1', 'roseCore.in'],
    ['bumpCells.f1', 'roseBumps.in'],
    ['roseCore.out', 'rosette.a'],
    ['roseBumps.out', 'rosette.b'],
    ['cells.edge', 'crease.in'],
    ['crease.out', 'depth.a'],
    ['rosette.out', 'depth.b'],
    // Light direction
    ['lightAngle.out', 'radians.a'],
    ['radians.out', 'sinAngle.in'],
    ['radians.out', 'cosAngle.in'],
    ['sinAngle.out', 'lightDir.x'],
    ['cosAngle.out', 'lightDir.y'],
    ['cosAngle.out', 'negCos.a'],
    ['negCos.out', 'acrossDir.x'],
    ['sinAngle.out', 'acrossDir.y'],
    // Sun band
    ['world.out', 'fromLight.a'],
    ['fromLight.out', 'across.a'],
    ['acrossDir.vec2', 'across.b'],
    ['across.out', 'acrossN.a'],
    ['acrossN.out', 'across2.a'],
    ['acrossN.out', 'across2.b'],
    ['across2.out', 'coreArg.a'],
    ['coreArg.out', 'core.in'],
    ['across2.out', 'glowArg.a'],
    ['glowArg.out', 'glowExp.in'],
    ['glowExp.out', 'glow.a'],
    ['core.out', 'profile.a'],
    ['glow.out', 'profile.b'],
    ['fromLight.out', 'along.a'],
    ['lightDir.vec2', 'along.b'],
    ['along.out', 'alongN.a'],
    ['alongN.out', 'ahead.a'],
    ['ahead.out', 'fadeArg.a'],
    ['fadeArg.out', 'fade.in'],
    ['alongN.out', 'entry.in'],
    ['profile.out', 'faded.a'],
    ['fade.out', 'faded.b'],
    ['faded.out', 'band.a'],
    ['entry.out', 'band.b'],
    ['band.out', 'bandLit.a'],
    ['lightStrength.out', 'bandLit.b'],
    ['world.out', 'worldSplit.in'],
    ['worldSplit.x', 'gradient.in'],
    ['bandLit.out', 'sunRaw.a'],
    ['gradient.out', 'sunRaw.b'],
    ['sunRaw.out', 'sun.in'],
    // Stamps
    ['depth.out', 'inside.in'],
    ['pf.out', 'stampCellsA.uv'],
    ['pf.out', 'turnB.in'],
    ['turnB.out', 'stampCellsB.uv'],
    ['pf.out', 'turnC.in'],
    ['turnC.out', 'stampCellsC.uv'],
    ['stampCellsA.f1', 'outsideA.in'],
    ['stampCellsB.f1', 'outsideB.in'],
    ['stampCellsC.f1', 'outsideC.in'],
    ['outsideA.out', 'outsideAB.a'],
    ['outsideB.out', 'outsideAB.b'],
    ['outsideAB.out', 'outsideABC.a'],
    ['outsideC.out', 'outsideABC.b'],
    ['outsideABC.out', 'stampsHit.b'],
    ['stampsHit.out', 'stampCount.a'],
    ['inside.out', 'stampCount.b'],
    // Darkness
    ['p.out', 'variationNoise.p'],
    ['variationNoise.out', 'variation.in'],
    ['stampCount.out', 'stacked.a'],
    ['variation.out', 'stacked.b'],
    ['sun.out', 'sunThin.a'],
    ['stacked.out', 'darkness.a'],
    ['sunThin.out', 'darkness.b'],
    ['darkness.out', 'toFill.in'],
    ['darkness.out', 'toStamps.in'],
    ['darkness.out', 'toStamp2.in'],
    ['darkness.out', 'toStamp3.in'],
    // Lace
    ['focus.out', 'breath.a'],
    ['sun.out', 'widen.a'],
    ['stampCount.out', 'touching.in'],
    ['touching.out', 'bite.a'],
    ['breath.out', 'growing.a'],
    ['widen.out', 'growing.b'],
    ['growing.out', 'grow.a'],
    ['bite.out', 'grow.b'],
    ['grow.out', 'laceEdge.a'],
    ['laceEdge.out', 'laceStep.edge'],
    ['depth.out', 'laceStep.in'],
    ['laceStep.out', 'laceMask.in'],
    ['grow.out', 'coreEdge.a'],
    ['coreEdge.out', 'coreStep.edge'],
    ['depth.out', 'coreStep.in'],
    ['coreStep.out', 'coreMask.in'],
    // Tones
    ['sun.out', 'toneLow.a'],
    ['sun.out', 'toneHigh.in'],
    ...TONES.flatMap(toneWires),
    // Body and lace
    ['rimTone.out', 'rimFill.a'],
    ['fillTone.out', 'rimFill.b'],
    ['toFill.out', 'rimFill.t'],
    ['stamp1Tone.out', 'spots12.a'],
    ['stamp2Tone.out', 'spots12.b'],
    ['toStamp2.out', 'spots12.t'],
    ['spots12.out', 'spots.a'],
    ['stamp3Tone.out', 'spots.b'],
    ['toStamp3.out', 'spots.t'],
    ['rimFill.out', 'body.a'],
    ['spots.out', 'body.b'],
    ['toStamps.out', 'body.t'],
    ['body.out', 'withLace.a'],
    ['laceTone.out', 'withLace.b'],
    ['laceMask.out', 'withLace.t'],
    ['withLace.out', 'withCore.a'],
    ['laceCoreTone.out', 'withCore.b'],
    ['coreMask.out', 'withCore.t'],
    // Vignette
    ['screenUv.out', 'screenCentered.a'],
    ['screenCentered.out', 'screenStretched.a'],
    ['screenStretched.out', 'screenDistance.in'],
    ['screenDistance.out', 'edgeFade.in'],
    ['edgeFade.out', 'vignette.a'],
    ['withCore.out', 'darkened.a'],
    ['withCore.out', 'final.a'],
    ['darkened.out', 'final.b'],
    ['vignette.out', 'final.t'],
    ['final.out', 'master.baseColor'],
  ],
  master: { params: { lighting: 'unlit' } },
}
