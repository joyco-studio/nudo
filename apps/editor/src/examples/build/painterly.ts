import { float, vec3 } from '@nudo-tsl/core'
import { colorRampStopInputIds } from '@nudo-tsl/nodes'

import type { ExampleSpec, GroupSpec, NodeSpec, PortPath, WireSpec } from './example-spec'
import { node, reader } from './example-spec'

/**
 * The painterly recipe every sphere of the user's `Shaders_style.blend` shares, rebuilt with nudo
 * nodes; each template is this recipe with its own numbers. In Blender: the Geometry normal, bent
 * by a Noise Color in Linear Light, snaps to the cells of a Minkowski Voronoi whose Position becomes
 * the Principled BSDF's normal, so the light breaks into brush-stroke facets. Shader to RGB turns the
 * lit result into one value for a Color Ramp of flat bands, and a paint texture is overlaid on top.
 *
 * Shader to RGB has no realtime equivalent, so the light is the Main Light's Lambert on the bent
 * normal (plus a Blinn gloss for the shiny ones) and the material is unlit. The `.blend`'s images
 * are not bundled: their paint, stripes and scan lines are patterns made from nodes, and its light
 * mask is a thresholded noise.
 */

type Vec3 = readonly [number, number, number]

/** A Color Ramp stop as Blender stores it: position, and a linear color. */
export interface RampStop {
  readonly position: number
  readonly color: Vec3
}

/** The paint the `.blend` overlays: Paint_texture's blotches, tile_texture_1's stripes, tile_texture_6's lines. */
export type PaintPattern = 'blotches' | 'stripes' | 'scanlines'

/** Blender's Gradient Texture types the spheres' base tone uses. */
export type GradientShape = 'linear' | 'spherical' | 'radial'

export interface PainterlyConfig {
  /** The Noise that bends the normal: Blender's Scale and Detail, and the Linear Light factor. */
  readonly bend: { readonly scale: number; readonly detail: number; readonly amount: number }
  /** The Minkowski Voronoi the bent normal snaps to. */
  readonly brush: { readonly scale: number; readonly exponent: number }
  /**
   * The Principled BSDF's base color: a fine Voronoi grain mixed (`gradient` = Blender's factor)
   * with a gradient that a Mapping places.
   */
  readonly base: {
    readonly shape: GradientShape
    readonly location: Vec3
    readonly rotation: Vec3
    readonly scale: Vec3
    readonly grainScale: number
    readonly gradient: number
  }
  /** A multiplier on the .blend's light (its sun and blue world); 1 is as measured. */
  readonly light: number
  /**
   * How much it reflects the sky instead of lighting its base: the Principled BSDF's Metallic,
   * tuned by eye where the copied value read too bright or too dark.
   */
  readonly metallic: number
  /** A Blinn highlight for the glossy spheres, standing in for the sun's specular; absent if matte. */
  readonly gloss?: { readonly strength: number; readonly shininess: number }
  /** The paint the `.blend` overlays; absent on the spheres that overlay plain grey (no change). */
  readonly paint?: {
    readonly pattern: PaintPattern
    /** What the paint Mapping reads: the mesh UV or the Generated coordinates. */
    readonly coords: 'uv' | 'generated'
    readonly scale: number
    /** The Mapping that places the paint: Blender's paint Mapping, its Value scale included. */
    readonly location: Vec3
    readonly rotation: Vec3
    readonly stretch: Vec3
    readonly dark: Vec3
    readonly light: Vec3
    /** Blender's Bright/Contrast on the paint image. */
    readonly brightness: number
    readonly contrast: number
    /** The Overlay factor over the ramp. */
    readonly overlay: number
  }
  readonly ramp: {
    readonly interpolation: 'constant' | 'smooth'
    readonly stops: readonly RampStop[]
  }
  /** The light mask's emissive streaks; absent on the spheres without one. */
  readonly sparkle?: { readonly amount: number; readonly scale: number }
  /** The Solidify + lineart outline; absent on the spheres without one. */
  readonly outline?: { readonly width: number }
}

/** Blender's Detail counts the octaves after the first. */
const octavesOf = (detail: number): number => Math.round(detail) + 1

/** Rec. 709 luma, how Blender turns a color into a ramp factor. */
const LUMA = vec3(0.2126, 0.7152, 0.0722)
/** A full turn, to bring atan2's -π…π to the radial gradient's 0…1. */
const INVERSE_TURN = 1 / (2 * Math.PI)
/** Where Blender's Generated coordinates start: the object's bounds, from 0 to 1. */
const HALF = 0.5
/**
 * The .blend's light as Shader to RGB sees it, tuned by eye against its renders: its sky world at
 * strength 0.7 lights every side by about 0.3, and its sun adds about half the Lambert.
 */
const WORLD_LIGHT = 0.3
const SUN_LIGHT = 0.55
/**
 * The .blend's sky is an image, so each bent normal sees a different brightness and the light
 * breaks into blotches all over. A plain key light only varies with the angle, so the bend is
 * pushed further to get the same blotches.
 */
export const BEND_BOOST = 1.6
/** What a metal reflects of the sky instead of lighting its base, tuned by eye. */
const WORLD_REFLECTION = 0.2

const v3 = ([x, y, z]: Vec3) => vec3(x, y, z)

const COORDS_GROUP: GroupSpec = {
  id: 'coords',
  title: 'Generated coordinates',
  body:
    "Blender's Generated coordinates run from 0 to 1 over the object's bounds, with Z up. Position " +
    'turned to Z up (X, −Z, Y), × 0.5 + 0.5, gives the same on a unit sphere, so the scales and ' +
    'rotations copied from the .blend still fit.',
  es: {
    title: 'Coordenadas Generated',
    body: 'Las coordenadas Generated de Blender van de 0 a 1 sobre los límites del objeto, con Z hacia arriba. La Posición girada a Z arriba (X, −Z, Y), × 0.5 + 0.5, da lo mismo en una esfera unitaria, así que las escalas y rotaciones copiadas del .blend siguen sirviendo.',
  },
  nodes: [
    node('position', 'input/position'),
    node('positionAxes', 'vector/split'),
    node('flipZ', 'math/multiply', { b: float(-1) }),
    node('zUp', 'vector/combine'),
    node('generatedHalf', 'math/multiply', { b: float(HALF) }),
    node('generated', 'math/add', { b: float(HALF) }),
  ],
}

const COORDS_WIRES: readonly WireSpec[] = [
  ['position.out', 'positionAxes.in'],
  ['positionAxes.z', 'flipZ.a'],
  ['positionAxes.x', 'zUp.x'],
  ['flipZ.out', 'zUp.y'],
  ['positionAxes.y', 'zUp.z'],
  ['zUp.vec3', 'generatedHalf.a'],
  ['generatedHalf.out', 'generated.a'],
]

function bendGroup(config: PainterlyConfig): GroupSpec {
  return {
    id: 'brush-normals',
    title: 'Brush normals',
    body:
      'The normal, bent by Noise Color in Linear Light, snaps to the cells of a Minkowski Voronoi: ' +
      'its exponent below 1 pinches each cell into a star. The normalized cell is the new normal, ' +
      'so the light breaks into brush-stroke facets.',
    es: {
      title: 'Normales de pincel',
      body: 'La normal, doblada por el Color de un Noise en Linear Light, se ajusta a las celdas de un Voronoi Minkowski: con exponente menor a 1, cada celda se vuelve una estrella. La celda normalizada es la nueva normal, y la luz se parte en facetas de pincelada.',
    },
    nodes: [
      node('normal', 'input/normal'),
      node(
        'bendNoise',
        'effects/noise',
        { scale: float(config.bend.scale) },
        { kind: 'perlin', octaves: octavesOf(config.bend.detail) },
      ),
      reader('bendAmount', 'bendAmount'),
      node('bent', 'color/blend', {}, { mode: 'linear-light' }),
      reader('brushScale', 'brushScale'),
      node(
        'brush',
        'effects/voronoi-3d',
        { exponent: float(config.brush.exponent) },
        { distance: 'minkowski' },
      ),
      node('brushNormal', 'vector/normalize'),
    ],
  }
}

const BEND_WIRES: readonly WireSpec[] = [
  ['generated.out', 'bendNoise.p'],
  ['normal.out', 'bent.base'],
  ['bendNoise.color', 'bent.blend'],
  ['bendAmount.out', 'bent.opacity'],
  ['bent.out', 'brush.position'],
  ['brushScale.out', 'brush.scale'],
  ['brush.cell', 'brushNormal.in'],
]

function lightGroup(config: PainterlyConfig): GroupSpec {
  const { gloss } = config
  const glossNodes: readonly NodeSpec[] =
    gloss === undefined
      ? []
      : [
          node('camera', 'input/camera-position'),
          node('surface', 'input/position', {}, { space: 'world' }),
          node('toCamera', 'math/subtract'),
          node('view', 'vector/normalize'),
          node('halfway', 'math/add'),
          node('halfwayNormalized', 'vector/normalize'),
          node('facingHalfway', 'vector/dot'),
          node('frontOnly', 'math/max', { b: float(0) }),
          node('shine', 'math/power', { b: float(gloss.shininess) }),
          node('gloss', 'math/multiply', { b: float(gloss.strength) }),
        ]
  const glossEn =
    ' A Blinn highlight (the normal against the halfway between light and view) adds the gloss.'
  const glossEs =
    ' Un brillo Blinn (la normal contra el punto medio entre luz y vista) suma el lustre.'
  return {
    id: 'light',
    title: 'Light',
    body:
      "The .blend's light on the brush normal: its sky lights every side by about 0.3, and its " +
      "sun adds about half the Main Light's Lambert." +
      (gloss === undefined ? '' : glossEn),
    es: {
      title: 'Luz',
      body:
        'La luz del .blend sobre la normal de pincel: su cielo ilumina todos los lados en unos 0.3, y su sol suma más o menos la mitad del Lambert de la Main Light.' +
        (gloss === undefined ? '' : glossEs),
    },
    nodes: [
      node('light', 'input/main-light'),
      node('sunlight', 'math/multiply', { b: float(SUN_LIGHT) }),
      node('daylight', 'math/add', { b: float(WORLD_LIGHT) }),
      ...glossNodes,
    ],
  }
}

function lightWires(config: PainterlyConfig): readonly WireSpec[] {
  const wires: WireSpec[] = [
    ['brushNormal.out', 'light.normal'],
    ['light.lambert', 'sunlight.a'],
    ['sunlight.out', 'daylight.a'],
  ]
  if (config.gloss === undefined) return wires
  return [
    ...wires,
    ['camera.out', 'toCamera.a'],
    ['surface.out', 'toCamera.b'],
    ['toCamera.out', 'view.in'],
    ['light.direction', 'halfway.a'],
    ['view.out', 'halfway.b'],
    ['halfway.out', 'halfwayNormalized.in'],
    ['brushNormal.out', 'facingHalfway.a'],
    ['halfwayNormalized.out', 'facingHalfway.b'],
    ['facingHalfway.out', 'frontOnly.a'],
    ['frontOnly.out', 'shine.a'],
    ['shine.out', 'gloss.a'],
  ]
}

interface GradientParts {
  readonly nodes: readonly NodeSpec[]
  readonly wires: readonly WireSpec[]
  readonly out: PortPath
}

function gradientParts(shape: GradientShape): GradientParts {
  if (shape === 'spherical') {
    return {
      nodes: [
        node('gradientReach', 'vector/length'),
        node('gradientFalloff', 'math/one-minus'),
        node('gradient', 'math/max', { b: float(0) }),
      ],
      wires: [
        ['placed.out', 'gradientReach.in'],
        ['gradientReach.out', 'gradientFalloff.in'],
        ['gradientFalloff.out', 'gradient.a'],
      ],
      out: 'gradient.out',
    }
  }
  if (shape === 'radial') {
    return {
      nodes: [
        node('gradientAxes', 'vector/split'),
        node('gradientAngle', 'math/atan2'),
        node('gradientTurns', 'math/multiply', { b: float(INVERSE_TURN) }),
        node('gradient', 'math/add', { b: float(HALF) }),
      ],
      wires: [
        ['placed.out', 'gradientAxes.in'],
        ['gradientAxes.y', 'gradientAngle.y'],
        ['gradientAxes.x', 'gradientAngle.x'],
        ['gradientAngle.out', 'gradientTurns.a'],
        ['gradientTurns.out', 'gradient.a'],
      ],
      out: 'gradient.out',
    }
  }
  return {
    nodes: [
      node('gradientAxes', 'vector/split'),
      node('gradient', 'math/clamp', { min: float(0), max: float(1) }),
    ],
    wires: [
      ['placed.out', 'gradientAxes.in'],
      ['gradientAxes.x', 'gradient.in'],
    ],
    out: 'gradient.out',
  }
}

const GRADIENT_NAMES: Readonly<
  Record<GradientShape, { readonly en: string; readonly es: string }>
> = {
  linear: { en: 'linear', es: 'lineal' },
  spherical: { en: 'spherical', es: 'esférico' },
  radial: { en: 'radial', es: 'radial' },
}

function baseGroup(config: PainterlyConfig): GroupSpec {
  const gradient = gradientParts(config.base.shape)
  const name = GRADIENT_NAMES[config.base.shape]
  return {
    id: 'base-tone',
    title: 'Base tone',
    body:
      `The Principled BSDF's base color: a ${name.en} gradient, placed by a Mapping, mixed with a ` +
      'fine Voronoi grain (Minkowski 2 is the true Euclidean distance Blender measures).',
    es: {
      title: 'Tono base',
      body: `El color base del Principled BSDF: un gradiente ${name.es}, ubicado con un Mapping, mezclado con un grano fino de Voronoi (Minkowski 2 es la distancia euclídea real que mide Blender).`,
    },
    nodes: [
      node('placed', 'vector/mapping', {
        location: v3(config.base.location),
        rotation: v3(config.base.rotation),
        scale: v3(config.base.scale),
      }),
      node(
        'grain',
        'effects/voronoi-3d',
        { scale: float(config.base.grainScale), exponent: float(2) },
        { distance: 'minkowski' },
      ),
      ...gradient.nodes,
      node('baseTone', 'interpolation/lerp', { t: float(config.base.gradient) }),
    ],
  }
}

function baseWires(config: PainterlyConfig): readonly WireSpec[] {
  const gradient = gradientParts(config.base.shape)
  return [
    ['generated.out', 'placed.vector'],
    ['placed.out', 'grain.position'],
    ...gradient.wires,
    ['grain.f1', 'baseTone.a'],
    [gradient.out, 'baseTone.b'],
  ]
}

interface PatternParts {
  readonly nodes: readonly NodeSpec[]
  readonly wires: readonly WireSpec[]
  readonly out: PortPath
  readonly en: string
  readonly es: string
}

function patternParts(pattern: PaintPattern, scale: number): PatternParts {
  if (pattern === 'stripes') {
    return {
      nodes: [
        node('stripeAxes', 'vector/split'),
        node('stripeWarp', 'effects/noise', { scale: float(3) }, { kind: 'perlin' }),
        node('stripeWobble', 'math/multiply', { b: float(0.15) }),
        node('stripeAcross', 'math/add'),
        node('stripeTurns', 'math/multiply', { b: float(scale) }),
        node('stripeWave', 'math/sin'),
        node('pattern', 'interpolation/smoothstep', { edge0: float(0.2), edge1: float(0.6) }),
      ],
      wires: [
        ['paintPlaced.out', 'stripeAxes.in'],
        ['paintPlaced.out', 'stripeWarp.p'],
        ['stripeWarp.out', 'stripeWobble.a'],
        ['stripeAxes.x', 'stripeAcross.a'],
        ['stripeWobble.out', 'stripeAcross.b'],
        ['stripeAcross.out', 'stripeTurns.a'],
        ['stripeTurns.out', 'stripeWave.in'],
        ['stripeWave.out', 'pattern.in'],
      ],
      out: 'pattern.out',
      en: 'wobbly stripes, a sine over X warped by a noise',
      es: 'rayas temblorosas, un seno sobre X deformado por un noise',
    }
  }
  if (pattern === 'scanlines') {
    return {
      nodes: [
        node('scanAxes', 'vector/split'),
        node('scanTurns', 'math/multiply', { b: float(scale) }),
        node('scanRow', 'math/fract'),
        node('pattern', 'interpolation/step', { edge: float(0.8) }),
      ],
      wires: [
        ['paintPlaced.out', 'scanAxes.in'],
        ['scanAxes.y', 'scanTurns.a'],
        ['scanTurns.out', 'scanRow.in'],
        ['scanRow.out', 'pattern.in'],
      ],
      out: 'pattern.out',
      en: 'thin scan lines, the fraction of Y × Scale cut by a Step',
      es: 'líneas finas de escaneo, la parte fraccionaria de Y × Escala cortada con un Step',
    }
  }
  return {
    nodes: [
      node(
        'pattern',
        'effects/voronoi-3d',
        { scale: float(scale), exponent: float(0.8) },
        { distance: 'minkowski' },
      ),
    ],
    wires: [['paintPlaced.out', 'pattern.position']],
    out: 'pattern.random',
    en: "flat blotches, one value per Minkowski Voronoi cell like Paint_texture's shards",
    es: 'manchas planas, un valor por celda de un Voronoi Minkowski, como los fragmentos de Paint_texture',
  }
}

type Paint = NonNullable<PainterlyConfig['paint']>

function paintGroup(paint: Paint): GroupSpec {
  const pattern = patternParts(paint.pattern, paint.scale)
  return {
    id: 'paint',
    title: 'Paint',
    body:
      `The .blend overlays a paint image; here it is ${pattern.en}. It runs from the dark to the ` +
      "light paint color, then through Bright/Contrast with the .blend's settings.",
    es: {
      title: 'Pintura',
      body: `El .blend superpone una imagen de pintura; acá son ${pattern.es}. Va del color oscuro al claro de la pintura y después pasa por Brillo/Contraste con los valores del .blend.`,
    },
    nodes: [
      ...(paint.coords === 'uv' ? [node('uv', 'input/uv')] : []),
      node('paintPlaced', 'vector/mapping', {
        location: v3(paint.location),
        rotation: v3(paint.rotation),
        scale: v3(paint.stretch),
      }),
      ...pattern.nodes,
      node('paintTone', 'interpolation/lerp', { a: v3(paint.dark), b: v3(paint.light) }),
      node('paint', 'color/bright-contrast', {
        brightness: float(paint.brightness),
        contrast: float(paint.contrast),
      }),
    ],
  }
}

function paintWires(paint: Paint): readonly WireSpec[] {
  const pattern = patternParts(paint.pattern, paint.scale)
  return [
    [paint.coords === 'uv' ? 'uv.out' : 'generated.out', 'paintPlaced.vector'],
    ...pattern.wires,
    [pattern.out, 'paintTone.t'],
    ['paintTone.out', 'paint.in'],
  ]
}

function rampInputs(config: PainterlyConfig) {
  return Object.fromEntries(
    config.ramp.stops.flatMap((stop, index) => {
      const ids = colorRampStopInputIds(index)
      return [
        [ids.position, float(stop.position)],
        [ids.color, v3(stop.color)],
      ]
    }),
  )
}

function shadeGroup(config: PainterlyConfig): GroupSpec {
  const metalNodes: readonly NodeSpec[] =
    config.metallic > 0
      ? [
          node('diffuse', 'math/multiply', { b: float(1 - config.metallic) }),
          node('reflected', 'math/add', { b: float(config.metallic * WORLD_REFLECTION) }),
        ]
      : []
  const glossNodes: readonly NodeSpec[] =
    config.gloss === undefined ? [] : [node('glossy', 'math/add')]
  const paintNodes: readonly NodeSpec[] =
    config.paint === undefined
      ? []
      : [node('paintLuma', 'vector/dot', { b: LUMA }), node('shade', 'math/add')]
  return {
    id: 'bands',
    title: 'Paint bands',
    body:
      "Blender's Shader to RGB: base tone × light" +
      (config.metallic > 0 ? ' (a metal mostly reflects the world instead)' : '') +
      (config.paint === undefined
        ? ''
        : ', with the paint added the way the .blend feeds it into Emission') +
      '. Its luma picks a color on the Color Ramp: flat bands, like strokes of paint.',
    es: {
      title: 'Bandas de pintura',
      body:
        'El Shader to RGB de Blender: tono base × luz' +
        (config.metallic > 0 ? ' (un metal refleja más que nada el mundo)' : '') +
        (config.paint === undefined ? '' : ', más la pintura, como el .blend la mete en Emission') +
        '. Su luma elige un color en la Color Ramp: bandas planas, como pinceladas.',
    },
    nodes: [
      node('lit', 'math/multiply'),
      reader('lightStrength', 'lightStrength'),
      node('litStrength', 'math/multiply'),
      ...metalNodes,
      ...glossNodes,
      ...paintNodes,
      node('bands', 'color/color-ramp', rampInputs(config), {
        count: config.ramp.stops.length,
        interpolation: config.ramp.interpolation,
      }),
    ],
  }
}

function shadeWires(config: PainterlyConfig): readonly WireSpec[] {
  const wires: WireSpec[] = [
    ['baseTone.out', 'lit.a'],
    ['daylight.out', 'lit.b'],
    ['lit.out', 'litStrength.a'],
    ['lightStrength.out', 'litStrength.b'],
  ]
  let shaded: PortPath = 'litStrength.out'
  if (config.metallic > 0) {
    wires.push([shaded, 'diffuse.a'], ['diffuse.out', 'reflected.a'])
    shaded = 'reflected.out'
  }
  if (config.gloss !== undefined) {
    wires.push([shaded, 'glossy.a'], ['gloss.out', 'glossy.b'])
    shaded = 'glossy.out'
  }
  if (config.paint === undefined) return [...wires, [shaded, 'bands.in']]
  return [
    ...wires,
    ['paint.out', 'paintLuma.a'],
    [shaded, 'shade.a'],
    ['paintLuma.out', 'shade.b'],
    ['shade.out', 'bands.in'],
  ]
}

function finishGroup(config: PainterlyConfig): GroupSpec {
  const sparkleNodes: readonly NodeSpec[] =
    config.sparkle === undefined
      ? []
      : [
          node(
            'sparkleNoise',
            'effects/noise',
            { scale: float(config.sparkle.scale) },
            { kind: 'perlin', octaves: 2 },
          ),
          node('sparkleMask', 'interpolation/smoothstep', {
            edge0: float(0.45),
            edge1: float(0.55),
          }),
          node('sparkle', 'math/multiply', { b: float(config.sparkle.amount) }),
          node('sparkled', 'math/add'),
        ]
  return {
    id: 'finish',
    title: 'Overlay',
    body: [
      config.paint === undefined ? '' : 'The paint, overlaid on the bands as in the .blend.',
      config.sparkle === undefined
        ? ''
        : "A noise's peaks stand in for the .blend's light mask: streaks that glow on top.",
    ]
      .filter((sentence) => sentence !== '')
      .join(' '),
    es: {
      title: 'Superposición',
      body: [
        config.paint === undefined ? '' : 'La pintura, superpuesta a las bandas como en el .blend.',
        config.sparkle === undefined
          ? ''
          : 'Los picos de un noise reemplazan la máscara de luz del .blend: vetas que brillan encima.',
      ]
        .filter((sentence) => sentence !== '')
        .join(' '),
    },
    nodes: [
      ...(config.paint === undefined
        ? []
        : [
            reader('paintOverlay', 'paintOverlay'),
            node('overlaid', 'color/blend', {}, { mode: 'overlay' }),
          ]),
      ...sparkleNodes,
    ],
  }
}

function finishWires(config: PainterlyConfig): readonly WireSpec[] {
  const wires: readonly WireSpec[] =
    config.paint === undefined
      ? []
      : [
          ['bands.out', 'overlaid.base'],
          ['paint.out', 'overlaid.blend'],
          ['paintOverlay.out', 'overlaid.opacity'],
        ]
  const colored: PortPath = config.paint === undefined ? 'bands.out' : 'overlaid.out'
  if (config.sparkle === undefined) return [...wires, [colored, 'master.baseColor']]
  return [
    ...wires,
    ['generated.out', 'sparkleNoise.p'],
    ['sparkleNoise.out', 'sparkleMask.in'],
    ['sparkleMask.out', 'sparkle.a'],
    [colored, 'sparkled.a'],
    ['sparkle.out', 'sparkled.b'],
    ['sparkled.out', 'master.baseColor'],
  ]
}

/** One painterly sphere of `Shaders_style.blend` as a template spec. */
export function painterlySpec(config: PainterlyConfig): ExampleSpec {
  const outlineParams = config.outline === undefined ? {} : { outline: true }
  const outlineInputs =
    config.outline === undefined ? {} : { outlineWidth: float(config.outline.width) }
  return {
    properties: [
      { name: 'bendAmount', label: 'Bend amount', value: float(config.bend.amount * BEND_BOOST) },
      { name: 'brushScale', label: 'Brush scale', value: float(config.brush.scale) },
      { name: 'lightStrength', label: 'Light strength', value: float(config.light) },
      ...(config.paint === undefined
        ? []
        : [{ name: 'paintOverlay', label: 'Paint overlay', value: float(config.paint.overlay) }]),
    ],
    groups: [
      COORDS_GROUP,
      bendGroup(config),
      lightGroup(config),
      baseGroup(config),
      ...(config.paint === undefined ? [] : [paintGroup(config.paint)]),
      shadeGroup(config),
      ...(config.paint === undefined && config.sparkle === undefined ? [] : [finishGroup(config)]),
    ],
    wires: [
      ...COORDS_WIRES,
      ...BEND_WIRES,
      ...lightWires(config),
      ...baseWires(config),
      ...(config.paint === undefined ? [] : paintWires(config.paint)),
      ...shadeWires(config),
      ...finishWires(config),
    ],
    master: { inputs: outlineInputs, params: { lighting: 'unlit', ...outlineParams } },
  }
}
