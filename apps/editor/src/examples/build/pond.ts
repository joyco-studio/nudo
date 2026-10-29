import { float, vec2, vec4 } from '@nudo-tsl/core'

import type { ExampleSpec, NodeSpec, PropertySpec, WireSpec } from './example-spec'
import { node, reader } from './example-spec'
import { hexColor } from './hex-color'

/**
 * Illustrated pond water seen from above: Voronoi rosettes with scalloped rims, lace channels
 * where they touch, darker stamps inside them and a band of sunlight, every layer swayed by
 * scrolling simplex noise and painted in flat tones that each blend from shade to sun.
 *
 * Every block here measurably changes the picture: parts that did not (an entry fade on the sun
 * band, a rim tone and an outer lace layer that the lace core always covered) were left out.
 */

/** Pond units across the mesh UV, times the scale from pond units to pattern units. */
const POND_SIZE = 13
const PATTERN_SCALE = 0.81
const PATTERN_SIZE = POND_SIZE * PATTERN_SCALE
/** Each refraction read's own scale. */
const NOISE_A_SCALE = 0.97
const NOISE_B_SCALE: readonly [number, number] = [-0.73, 0.8]
/** Each refraction read's scroll per second of wave time, in its own noise space. */
const NOISE_A_SCROLL: readonly [number, number] = [0.04006, 0.02465]
const NOISE_B_SCROLL: readonly [number, number] = [-0.006, 0.012]
/** How far the refraction moves the pattern, and how much more it bends the rosettes. */
const WAVE_AMP = 0.185
const ROSETTE_WOBBLE = 1.7
/** Computed F1 spans less than a cell, so it is scaled up to reach the rosette radius. */
const F1_GAIN = 1.65
const ROSETTE_RADIUS = 0.8
const BUMP_FREQUENCY = 7.4
const BUMP_DEPTH = 0.33
/** The crease between rosettes: how steeply it rises off a cell edge (F2 − F1), and its offset. */
const CREASE_SHARPNESS = 4
const CREASE_OFFSET = 0.15
const STAMP_RADIUS = 0.55 / F1_GAIN
const STAMP_FREQUENCIES = { a: 3.65, b: 5, c: 1.95 } as const
/** Two of the stamp reads turn: by atan2(0.6, 0.8) one way and atan2(0.8, 0.6) the other. */
const STAMP_ROTATIONS = { b: -0.6435, c: 0.9273 } as const
/** Where the light enters, in pond units. */
const LIGHT_POSITION: readonly [number, number] = [8, -5]
const DEGREES_TO_RADIANS = Math.PI / 180
/** The band's half width across the light and its fade length along it, in pond units. */
const BAND_WIDTH = 8
const BAND_LENGTH = 3.5
/** The wide glow: its height next to the sharp core, and how much wider it spreads. */
const BAND_GLOW = 0.76
const GLOW_SPREAD = 0.08
const AMBIENT_LIGHT = 0.05
/** Ambient light rises by this much per pond unit toward the right. */
const AMBIENT_GRADIENT = 0.021
/** Below this light a tone blends shade to mid, above it mid to sun. */
const MID_LIGHT = 0.3
const THIN_STAMPS = 1.88
/** The darkness before stamps and sun, and how far the slow noise moves it. */
const DARKNESS_BIAS = 1
const DARKNESS_VARIATION = 2
/** How much the lace grows per unit of each refraction read, and per unit of sun. */
const LACE_BREATH = 0.0175
const LACE_WIDEN = 0.1
const LACE_BITE = 0.132
/** The lace's edge, in rosette depth, with no breath, sun or stamps. */
const LACE_EDGE = -0.028
/** The edge darkening: how far it reaches, and how dark the very edge gets. */
const VIGNETTE_STRENGTH = 0.4457
const VIGNETTE_DARKEN = 0.214
const VIGNETTE_STRETCH: readonly [number, number] = [1.4375, 1.15]

type Tone = 'fill' | 'stamp1' | 'stamp2' | 'stamp3' | 'lace'
type Light = 'Shade' | 'Mid' | 'Sun'

/** Each tone in shade, at mid light and in full sun. */
const PALETTE: Readonly<Record<Tone, Readonly<Record<Light, string>>>> = {
  fill: { Shade: '#056646', Mid: '#12814A', Sun: '#97BC53' },
  stamp1: { Shade: '#045842', Mid: '#08724A', Sun: '#6CAD4F' },
  stamp2: { Shade: '#044D3E', Mid: '#086444', Sun: '#4A9F4C' },
  stamp3: { Shade: '#084336', Mid: '#075A40', Sun: '#2E924A' },
  lace: { Shade: '#418E45', Mid: '#8FBC52', Sun: '#F9F2BC' },
}

const TONE_LABELS: Readonly<Record<Tone, string>> = {
  fill: 'Fill',
  stamp1: 'Stamp 1',
  stamp2: 'Stamp 2',
  stamp3: 'Stamp 3',
  lace: 'Lace',
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

/** A tone at the current light: shade to mid while the light rises to mid, then mid to sun. */
function toneNodes(tone: Tone): readonly NodeSpec[] {
  return [
    ...LIGHTS.map((light) => reader(`${tone}${light}`, `${tone}${light}`)),
    node(`${tone}Low`, 'interpolation/lerp', {}, { showPreview: false }),
    node(`${tone}Tone`, 'interpolation/lerp', {}, { showPreview: false }),
  ]
}

function toneWires(tone: Tone): readonly WireSpec[] {
  return [
    [`${tone}Shade.out`, `${tone}Low.a`],
    [`${tone}Mid.out`, `${tone}Low.b`],
    ['toMid.out', `${tone}Low.t`],
    [`${tone}Low.out`, `${tone}Tone.a`],
    [`${tone}Sun.out`, `${tone}Tone.b`],
    ['toSun.out', `${tone}Tone.t`],
  ]
}

export const POND: ExampleSpec = {
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
        body: 'El UV de la malla centrado y escalado al espacio del patrón, con +y hacia abajo. p es el espacio que leen todas las capas.',
      },
      body:
        'The mesh UV, centered and scaled to pattern space, +y toward the bottom. p is the space ' +
        'every layer reads.',
      nodes: [
        node('uv', 'input/uv'),
        node('centered', 'math/subtract', { b: float(0.5) }),
        node('p', 'math/multiply', { b: vec2(PATTERN_SIZE, -PATTERN_SIZE) }),
      ],
    },
    {
      id: 'refraction',
      title: 'Refraction',
      es: {
        title: 'Refracción',
        body: 'Dos lecturas de noise se desplazan, cada una a su velocidad y ángulo. Juntas dan un único desvío que dobla todas las capas igual, así el patrón se mece como agua; las rosetas se doblan un poco más. breath hace respirar al encaje con ellas.',
      },
      body:
        'Two noise reads scroll at their own speed and angle. Together they give one offset that ' +
        'bends every layer the same way, so the whole pattern sways like water; the rosettes ' +
        'bend a little more. breath makes the lace breathe with them.',
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
        node('breath', 'vector/dot', { b: vec2(LACE_BREATH, LACE_BREATH) }),
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
          outMax: float(-0.75 * BUMP_DEPTH),
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
      id: 'sun-band',
      title: 'Sun band',
      es: {
        title: 'Banda de sol',
        body: 'Rotate 2D gira el estanque al ángulo de la luz, así un Split da la distancia a través de la luz y a lo largo de ella. La banda es un núcleo gaussiano nítido más un brillo ancho, que se apaga a lo largo desde donde entra la luz (cada uno es un solo Exp). Un leve degradado de izquierda a derecha evita que la sombra quede plana.',
      },
      body:
        'Rotate 2D turns the pond to the light angle, so one Split gives the distance across the ' +
        'light and along it. The band is a sharp Gaussian core plus a wide glow, fading along ' +
        'from where the light enters (each one a single Exp). A slight left-to-right gradient ' +
        'keeps the shade from going flat.',
      nodes: [
        reader('lightAngle', 'lightAngle'),
        node('radians', 'math/multiply', { b: float(DEGREES_TO_RADIANS) }),
        node('fromLight', 'math/subtract', {
          b: vec2(LIGHT_POSITION[0] * PATTERN_SCALE, LIGHT_POSITION[1] * PATTERN_SCALE),
        }),
        node('turned', 'vector/rotate-2d', { center: vec2(0, 0) }),
        // Across in band widths (its sign does not matter, it is squared) and minus along in
        // fade lengths, so that min(·, 0) is minus how far ahead of the light a point is.
        node('bandSpace', 'math/multiply', {
          b: vec2(1 / (BAND_WIDTH * PATTERN_SCALE), -1 / (BAND_LENGTH * PATTERN_SCALE)),
        }),
        node('acrossAlong', 'vector/split'),
        node('across2', 'math/multiply'),
        node('ahead', 'math/min', { b: float(0) }),
        node('coreArg', 'math/subtract'),
        node('core', 'math/exp'),
        // BAND_GLOW · exp(−GLOW_SPREAD · x²) = exp(ln BAND_GLOW − GLOW_SPREAD · x²).
        node('glowSpread', 'math/remap', {
          outMin: float(Math.log(BAND_GLOW)),
          outMax: float(Math.log(BAND_GLOW) - GLOW_SPREAD),
        }),
        node('glowArg', 'math/add'),
        node('glow', 'math/exp'),
        node('band', 'math/add'),
        reader('lightStrength', 'lightStrength'),
        node('bandLit', 'math/multiply'),
        node('pSplit', 'vector/split'),
        node('gradient', 'math/remap', {
          inMax: float(PATTERN_SCALE),
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
        body: 'Tres lecturas más de Voronoi, a otras escalas y dos de ellas rotadas, cortadas en manchas redondas con AA Step. Una Dot cuenta en cuántas manchas cae un punto; esa cantidad, solo dentro de las rosetas, oscurece el agua.',
      },
      body:
        'Three more Voronoi reads, at other scales and two of them rotated, cut into round dabs ' +
        'with AA Step. A Dot counts the dabs a point is in; that count, only inside the ' +
        'rosettes, darkens the water.',
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
        // The three reads as one vec4 (its preview would only tint them), so one Dot counts the hits.
        node('stampTerms', 'vector/combine', { w: float(1) }, { showPreview: false }),
        node('stampsHit', 'vector/dot', { b: vec4(-1, -1, -1, 3) }),
        node('stampCount', 'math/multiply'),
      ],
    },
    {
      id: 'darkness',
      title: 'Darkness',
      es: {
        title: 'Oscuridad',
        body: 'Una Dot pesa la cantidad de sellos, un noise lento y el sol (que la aclara), más un sesgo fijo en w. Cada umbral de AA Step pasa al tono siguiente, más oscuro.',
      },
      body:
        'One Dot weighs the stamp count, a slow noise and the sun (which thins it out), plus a ' +
        'fixed bias in w. Each AA Step threshold moves to the next, darker tone.',
      nodes: [
        node('variationNoise', 'effects/noise', { scale: float(0.05) }, { kind: 'simplex' }),
        node('darknessTerms', 'vector/combine', { w: float(1) }),
        node('darkness', 'vector/dot', {
          b: vec4(1, DARKNESS_VARIATION, -THIN_STAMPS, DARKNESS_BIAS),
        }),
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
        body: 'El agua abierta entre rosetas y los pliegues donde se tocan, como una máscara nítida: AA Step corta depth en un borde que respira con la refracción, se ensancha bajo el sol y retrocede donde hay sellos; un Clamp evita que varios sellos superpuestos muerdan más de uno.',
      },
      body:
        'The open water between rosettes and the creases where they touch, as one crisp mask: ' +
        'AA Step cuts depth at an edge that breathes with the refraction, widens under the sun ' +
        'and backs off where stamps are, with a Clamp so overlapping stamps bite no more than one.',
      nodes: [
        node('widen', 'math/remap', {
          outMin: float(LACE_EDGE),
          outMax: float(LACE_EDGE + LACE_WIDEN),
        }),
        node('touching', 'math/clamp'),
        node('bite', 'math/multiply', { b: float(LACE_BITE) }),
        node('growing', 'math/add'),
        node('laceEdge', 'math/subtract'),
        node('laceStep', 'interpolation/aa-step'),
      ],
    },
    {
      id: 'tones',
      title: 'Tones',
      es: {
        title: 'Tonos',
        body: 'Cada tono mezcla sus colores de sombra, medio y sol según la luz: de sombra a medio mientras la luz sube hasta la luz media (0.3), y de ahí a sol. toMid y toSun son esos dos tramos, cada uno recortado a 0..1.',
      },
      body:
        'Each tone blends its shade, mid and sun colors by the light: shade to mid while the ' +
        'light rises to the mid light (0.3), then on to sun. toMid and toSun are those two ' +
        'stretches, each clamped to 0..1.',
      nodes: [
        node('midShare', 'math/divide', { b: float(MID_LIGHT) }),
        node('toMid', 'math/min', { b: float(1) }),
        node('sunShare', 'math/remap', { inMin: float(MID_LIGHT) }),
        node('toSun', 'math/max', { b: float(0) }),
        ...TONES.flatMap(toneNodes),
      ],
    },
    {
      id: 'body',
      title: 'Body and lace',
      es: {
        title: 'Cuerpo y encaje',
        body: 'Tonos planos pintados, del más claro al más oscuro según los umbrales de oscuridad, y encima el encaje, en capas con Lerp.',
      },
      body:
        'Flat painted tones, lightest to darkest by the darkness thresholds, then the lace ' +
        'layered over them with Lerp.',
      nodes: [
        node('spots12', 'interpolation/lerp'),
        node('spots', 'interpolation/lerp'),
        node('body', 'interpolation/lerp'),
        node('withLace', 'interpolation/lerp'),
      ],
    },
    {
      id: 'vignette',
      title: 'Vignette',
      es: {
        title: 'Viñeta',
        body: 'El estanque se oscurece hacia los bordes de la vista, en espacio de pantalla: la distancia al centro, estirada a lo ancho, se vuelve un factor que multiplica el color.',
      },
      body:
        'The pond darkens toward the edges of the view, in screen space: the distance from the ' +
        'center, stretched sideways, becomes a factor the color is multiplied by.',
      nodes: [
        node('screenUv', 'input/screen-uv'),
        node('screenStretched', 'math/multiply', { b: vec2(...VIGNETTE_STRETCH) }),
        node('screenDistance', 'math/distance', {
          b: vec2(VIGNETTE_STRETCH[0] / 2, VIGNETTE_STRETCH[1] / 2),
        }),
        node('edgeFade', 'interpolation/smoothstep', { edge0: float(0.32), edge1: float(0.95) }),
        node('shading', 'math/remap', {
          outMin: float(1),
          outMax: float(1 - VIGNETTE_STRENGTH * (1 - VIGNETTE_DARKEN)),
        }),
        node('final', 'math/multiply'),
      ],
    },
  ],
  wires: [
    // Pond space
    ['uv.out', 'centered.a'],
    ['centered.out', 'p.a'],
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
    ['offset.vec2', 'breath.a'],
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
    // Sun band
    ['lightAngle.out', 'radians.a'],
    ['p.out', 'fromLight.a'],
    ['fromLight.out', 'turned.in'],
    ['radians.out', 'turned.angle'],
    ['turned.out', 'bandSpace.a'],
    ['bandSpace.out', 'acrossAlong.in'],
    ['acrossAlong.x', 'across2.a'],
    ['acrossAlong.x', 'across2.b'],
    ['acrossAlong.y', 'ahead.a'],
    ['ahead.out', 'coreArg.a'],
    ['across2.out', 'coreArg.b'],
    ['coreArg.out', 'core.in'],
    ['across2.out', 'glowSpread.in'],
    ['glowSpread.out', 'glowArg.a'],
    ['ahead.out', 'glowArg.b'],
    ['glowArg.out', 'glow.in'],
    ['core.out', 'band.a'],
    ['glow.out', 'band.b'],
    ['band.out', 'bandLit.a'],
    ['lightStrength.out', 'bandLit.b'],
    ['p.out', 'pSplit.in'],
    ['pSplit.x', 'gradient.in'],
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
    ['outsideA.out', 'stampTerms.x'],
    ['outsideB.out', 'stampTerms.y'],
    ['outsideC.out', 'stampTerms.z'],
    ['stampTerms.vec4', 'stampsHit.a'],
    ['stampsHit.out', 'stampCount.a'],
    ['inside.out', 'stampCount.b'],
    // Darkness
    ['p.out', 'variationNoise.p'],
    ['stampCount.out', 'darknessTerms.x'],
    ['variationNoise.out', 'darknessTerms.y'],
    ['sun.out', 'darknessTerms.z'],
    ['darknessTerms.vec4', 'darkness.a'],
    ['darkness.out', 'toStamps.in'],
    ['darkness.out', 'toStamp2.in'],
    ['darkness.out', 'toStamp3.in'],
    // Lace
    ['sun.out', 'widen.in'],
    ['stampCount.out', 'touching.in'],
    ['touching.out', 'bite.a'],
    ['breath.out', 'growing.a'],
    ['widen.out', 'growing.b'],
    ['growing.out', 'laceEdge.a'],
    ['bite.out', 'laceEdge.b'],
    ['laceEdge.out', 'laceStep.edge'],
    ['depth.out', 'laceStep.in'],
    // Tones
    ['sun.out', 'midShare.a'],
    ['midShare.out', 'toMid.a'],
    ['sun.out', 'sunShare.in'],
    ['sunShare.out', 'toSun.a'],
    ...TONES.flatMap(toneWires),
    // Body and lace
    ['stamp1Tone.out', 'spots12.a'],
    ['stamp2Tone.out', 'spots12.b'],
    ['toStamp2.out', 'spots12.t'],
    ['spots12.out', 'spots.a'],
    ['stamp3Tone.out', 'spots.b'],
    ['toStamp3.out', 'spots.t'],
    ['fillTone.out', 'body.a'],
    ['spots.out', 'body.b'],
    ['toStamps.out', 'body.t'],
    ['laceTone.out', 'withLace.a'],
    ['body.out', 'withLace.b'],
    ['laceStep.out', 'withLace.t'],
    // Vignette
    ['screenUv.out', 'screenStretched.a'],
    ['screenStretched.out', 'screenDistance.a'],
    ['screenDistance.out', 'edgeFade.in'],
    ['edgeFade.out', 'shading.in'],
    ['withLace.out', 'final.a'],
    ['shading.out', 'final.b'],
    ['final.out', 'master.baseColor'],
  ],
  master: { params: { lighting: 'unlit' } },
}
