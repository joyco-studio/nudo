import { float, vec2, vec3 } from '@nudo-tsl/core'
import { colorRampStopInputIds } from '@nudo-tsl/nodes'

import { templateTexture } from '../template-texture'
import { BRUSH_STROKE, STROKE_MASK } from './bundled-textures'
import type { ExampleSpec } from './example-spec'
import { node, reader } from './example-spec'

/**
 * The palette of the user's Blender material "art", darkest first, at the positions its Color Ramp
 * has them: everything the light leaves under 0.80 is navy, and the lit side runs through blue and
 * green to coral and cream within the last fifth. The colors are the ramp's own values, in linear
 * light as Blender stores them (navy #030040, blue #0505E0, green #00E652, coral #FF4742 and cream
 * #EDE5CC, read as linear × 255); the editor shows them in sRGB.
 */
const PALETTE = [
  { position: 0.8, linear: [0.014, 0.003, 0.252] },
  { position: 0.84, linear: [0.02, 0.018, 0.882] },
  { position: 0.9, linear: [0.005, 0.899, 0.319] },
  { position: 0.95, linear: [1, 0.284, 0.256] },
  { position: 1, linear: [0.931, 0.905, 0.799] },
] as const

/** The Color Ramp's stops, as its inline inputs. */
const rampStops = Object.fromEntries(
  PALETTE.flatMap(({ position, linear: [red, green, blue] }, index) => {
    const ids = colorRampStopInputIds(index)
    return [
      [ids.position, float(position)],
      [ids.color, vec3(red, green, blue)],
    ]
  }),
)

/**
 * Where the light lands on the ramp: the shadow just under navy, full light just past cream, so the
 * palette spreads over the lit side as it does in the Blender render.
 */
const RAMP_FROM = 0.7
const RAMP_TO = 0.97
/**
 * The brush texture's middle grey once the GPU has read it (sRGB to linear): offsets are measured
 * from it, so the strokes brighten and darken about evenly.
 */
const BRUSH_MIDDLE = 0.3
/** A sphere's UV runs twice as far around as from pole to pole: this keeps the strokes unstretched. */
const SPHERE_UV_ASPECT = vec2(2, 1)
/** The stroke mask repeats this many times faster than the brush, so its bites stay small. */
const MASK_REPEAT = 2
/** How far the noise bends the facet cells, in object units. */
const FACET_WARP = 0.35

/**
 * After the user's Blender material "art": lighting read as a color (Shader to RGB), pushed through
 * a five-color Color Ramp, with the normal broken into Voronoi facets so the light falls in flat
 * painted patches, a brush-stroke image blended in and ragged, brushed-off edges cut by a stroke
 * mask. Main Light's Half Lambert stands in for Shader to RGB. The facets tilt the world normal per
 * Voronoi cell by a Random direction, as Blender's Voronoi Position does: Normal From Height makes a
 * view-space normal for the Master Stack, which Main Light can't read. Both images are bundled (see
 * `textures/paint-strokes.ts`).
 */
export const BRUSH_TOON: ExampleSpec = {
  textures: [BRUSH_STROKE, STROKE_MASK],
  properties: [
    { name: 'facetScale', label: 'Facet scale', value: float(6) },
    { name: 'facetTilt', label: 'Facet tilt', value: float(0.18) },
    { name: 'paint', label: 'Paint', value: float(0.3) },
    { name: 'brushScale', label: 'Brush scale', value: float(1.6) },
    { name: 'edgeBite', label: 'Edge bite', value: float(0.5) },
  ],
  groups: [
    {
      id: 'facets',
      title: 'Painted facets',
      body:
        'Voronoi 3D over a noise-bent position cuts the mesh into cells. Random gives each cell ' +
        'its own direction (Out3, moved to -1…1); added to the normal × facet tilt, it tips every ' +
        'cell toward or away from the light like a flat brush dab.',
      es: {
        title: 'Facetas pintadas',
        body: 'Voronoi 3D sobre una posición doblada por un noise corta el mesh en celdas. Random le da a cada celda su propia dirección (Out3, llevada a -1…1); sumada a la normal × facet tilt, inclina cada celda hacia la luz o en contra, como una pincelada plana.',
      },
      nodes: [
        node('position', 'input/position'),
        node('warpNoise', 'effects/noise', { scale: float(1.5) }, { kind: 'simplex' }),
        node('warpOffset', 'math/multiply', { b: float(FACET_WARP) }),
        node('warped', 'math/add'),
        reader('facetScale', 'facetScale'),
        node('facetCells', 'effects/voronoi-3d'),
        node('cellRandom', 'math/hash'),
        node('cellDirection', 'math/remap', { outMin: float(-1), outMax: float(1) }),
        reader('facetTilt', 'facetTilt'),
        node('tilt', 'math/multiply'),
        node('normal', 'input/normal'),
        node('tilted', 'math/add'),
        node('facetNormal', 'vector/normalize'),
      ],
    },
    {
      id: 'strokes',
      title: 'Brush strokes',
      body:
        'The bundled brush texture, read at the UV × 2, 1 (a sphere runs twice as far around as ' +
        'up) × brush scale: flat strokes in many greys, with bristle streaks and dry gaps. Its ' +
        'grey is the brush value.',
      es: {
        title: 'Pinceladas',
        body: 'La textura de pinceladas incluida, leída en el UV × 2, 1 (una esfera da el doble de vuelta que de alto) × brush scale: trazos planos en muchos grises, con vetas de cerdas y huecos de pincel seco. Su gris es el valor del pincel.',
      },
      nodes: [
        node('uv', 'input/uv'),
        node('uvAspect', 'math/multiply', { b: SPHERE_UV_ASPECT }),
        reader('brushScale', 'brushScale'),
        node('brushUv', 'math/multiply'),
        node('brush', 'texture/sample-texture-2d', { texture: templateTexture(BRUSH_STROKE) }),
        node('brushValue', 'vector/split'),
      ],
    },
    {
      id: 'light',
      title: 'Light as a value',
      body:
        "Main Light's Half Lambert on the faceted normal: Blender's Shader to RGB. The brush " +
        'value, around its middle × paint, shifts it so the colors break along the strokes. ' +
        'Remap squeezes it into the band the palette sits in.',
      es: {
        title: 'La luz como valor',
        body: 'El Half Lambert de Main Light sobre la normal facetada: el Shader to RGB de Blender. El valor del pincel, alrededor de su medio × paint, lo corre para que los colores se corten siguiendo los trazos. Remap lo aprieta en la franja donde está la paleta.',
      },
      nodes: [
        node('mainLight', 'input/main-light'),
        node('brushCentered', 'math/subtract', { b: float(BRUSH_MIDDLE) }),
        reader('paint', 'paint'),
        node('brushShift', 'math/multiply'),
        node('litPaint', 'math/add'),
        node('rampIn', 'math/remap', { outMin: float(RAMP_FROM), outMax: float(RAMP_TO) }),
      ],
    },
    {
      id: 'palette',
      title: 'Palette',
      body:
        'The five colors of the Blender ramp at its positions: navy up to 0.80, then blue, ' +
        'green, coral and cream. Smooth eases between them, like its B-spline. The brush ' +
        'texture goes over them in soft light, half strength, so the streaks show in every color.',
      es: {
        title: 'Paleta',
        body: 'Los cinco colores de la rampa de Blender en sus posiciones: navy hasta 0.80, después azul, verde, coral y crema. Smooth suaviza el paso entre ellos, como su B-spline. La textura de pinceladas va encima en soft light, a media fuerza, así las vetas se ven en todos los colores.',
      },
      nodes: [
        node('palette', 'color/color-ramp', rampStops, {
          count: PALETTE.length,
          interpolation: 'smooth',
        }),
        node('painted', 'color/blend', { opacity: float(0.5) }, { mode: 'soft-light' }),
      ],
    },
    {
      id: 'edges',
      title: 'Brushed-off edges',
      body:
        'The bundled stroke mask, twice as fine as the brush: white strokes with dark gaps. ' +
        'Fresnel rises toward the silhouette; there Lerp swaps full opacity for the mask, and ' +
        'Alpha Clip cuts away what falls under Edge bite, so the edge frays along the strokes. ' +
        '0 keeps the edge whole.',
      es: {
        title: 'Bordes de pincel',
        body: 'La máscara de trazos incluida, el doble de fina que el pincel: trazos blancos con huecos oscuros. Fresnel crece hacia la silueta; ahí Lerp cambia la opacidad llena por la máscara y Alpha Clip recorta lo que queda debajo de Edge bite, así el borde se deshilacha siguiendo los trazos. 0 deja el borde entero.',
      },
      nodes: [
        node('maskUv', 'math/multiply', { b: float(MASK_REPEAT) }),
        node('mask', 'texture/sample-texture-2d', { texture: templateTexture(STROKE_MASK) }),
        node('maskValue', 'vector/split'),
        node('rim', 'effects/fresnel', { power: float(2.5) }),
        node('edgeOpacity', 'interpolation/lerp', { a: float(1) }),
        reader('edgeBite', 'edgeBite'),
      ],
    },
  ],
  wires: [
    ['position.out', 'warpNoise.p'],
    ['warpNoise.out', 'warpOffset.a'],
    ['position.out', 'warped.a'],
    ['warpOffset.out', 'warped.b'],
    ['warped.out', 'facetCells.position'],
    ['facetScale.out', 'facetCells.scale'],
    ['facetCells.cell', 'cellRandom.in'],
    ['cellRandom.out3', 'cellDirection.in'],
    ['cellDirection.out', 'tilt.a'],
    ['facetTilt.out', 'tilt.b'],
    ['normal.out', 'tilted.a'],
    ['tilt.out', 'tilted.b'],
    ['tilted.out', 'facetNormal.in'],
    ['facetNormal.out', 'mainLight.normal'],
    ['uv.out', 'uvAspect.a'],
    ['uvAspect.out', 'brushUv.a'],
    ['brushScale.out', 'brushUv.b'],
    ['brushUv.out', 'brush.uv'],
    ['brush.rgb', 'brushValue.in'],
    ['brushValue.x', 'brushCentered.a'],
    ['brushCentered.out', 'brushShift.a'],
    ['paint.out', 'brushShift.b'],
    ['mainLight.halfLambert', 'litPaint.a'],
    ['brushShift.out', 'litPaint.b'],
    ['litPaint.out', 'rampIn.in'],
    ['rampIn.out', 'palette.in'],
    ['palette.out', 'painted.base'],
    ['brush.rgb', 'painted.blend'],
    ['painted.out', 'master.baseColor'],
    ['brushUv.out', 'maskUv.a'],
    ['maskUv.out', 'mask.uv'],
    ['mask.rgb', 'maskValue.in'],
    ['maskValue.x', 'edgeOpacity.b'],
    ['rim.out', 'edgeOpacity.t'],
    ['edgeOpacity.out', 'master.opacity'],
    ['edgeBite.out', 'master.alphaClip'],
  ],
  master: { params: { lighting: 'unlit', surface: 'opaque' } },
}
