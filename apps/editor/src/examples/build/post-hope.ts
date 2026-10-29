import { float } from '@nudo-tsl/core'

import type { ExampleSpec } from './example-spec'
import { node, reader } from './example-spec'
import { hexColor } from './hex-color'
import {
  LIGHT_DIRECTION,
  LIGHT_SHADE_NODES,
  LIGHT_SHADE_OUT,
  LIGHT_SHADE_WIRES,
} from './light-shade'

/**
 * Stripes per unit of screen height, in radians: about 60 stripe pairs down the preview, the
 * screen-print pitch of spite's 10-pixel rows at a typical panel size.
 */
const STRIPE_DENSITY = 380

/** Where each ink starts on the shade ramp, darkest first: below the first one is navy. */
const RED_FROM = 0.42
const BLUE_FROM = 0.56
const STRIPES_FROM = 0.7
const CREAM_FROM = 0.82

/**
 * spite's "post-hope" sketch (github.com/spite/sketch, MIT) as one material: the light, cut into
 * the four inks of the Hope poster with a striped band between blue and cream, edges wobbled by
 * noise like hand-cut stencils, and a navy outline where the surface turns away. spite finds the
 * outline with a Sobel pass over the rendered scene; a material sees one point at a time, so a
 * fresnel stands in for it and draws the silhouette.
 */
export const POST_HOPE: ExampleSpec = {
  properties: [
    LIGHT_DIRECTION,
    { name: 'navy', label: 'Navy', value: hexColor('#00324C'), widget: 'color' },
    { name: 'red', label: 'Red', value: hexColor('#D81B21'), widget: 'color' },
    { name: 'blue', label: 'Blue', value: hexColor('#7EA4AE'), widget: 'color' },
    { name: 'cream', label: 'Cream', value: hexColor('#FDE4A8'), widget: 'color' },
    { name: 'edgeWobble', label: 'Edge wobble', value: float(0.05) },
    { name: 'stripeDensity', label: 'Stripe density', value: float(STRIPE_DENSITY) },
    { name: 'outline', label: 'Outline', value: float(0.62) },
  ],
  groups: [
    {
      id: 'light',
      title: 'Light',
      es: {
        title: 'Luz',
        body: 'Normal · dirección de la luz: cuánto mira cada punto hacia la luz. El Remap lo lleva de -1…1 a 0…1, así el lado oscuro también tiene matices.',
      },
      body:
        'Normal · light direction: how much each point faces the light. The Remap takes it ' +
        'from -1…1 to 0…1, so the dark side still has shades in it.',
      nodes: LIGHT_SHADE_NODES,
    },
    {
      id: 'hand-cut',
      title: 'Hand-cut edges',
      es: {
        title: 'Bordes recortados a mano',
        body: 'Un poco de noise sumado a la luz hace temblar los bordes entre tintas, como un esténcil cortado a mano.',
      },
      body:
        'A little noise added to the light makes the edges between inks waver, like a stencil ' +
        'cut by hand.',
      nodes: [
        node('position', 'input/position'),
        node('wobbleNoise', 'effects/noise', { scale: float(7) }, { kind: 'simplex' }),
        reader('edgeWobble', 'edgeWobble'),
        node('wobble', 'math/multiply'),
        node('cutShade', 'math/add'),
      ],
    },
    {
      id: 'stripes',
      title: 'Stripes',
      es: {
        title: 'Rayas',
        body: 'Screen UV.y × densidad por un seno da filas horizontales en pantalla; AA Step las corta en rayas nítidas de azul y crema.',
      },
      body:
        'Screen UV.y × density through a sine gives rows across the screen; AA Step cuts them ' +
        'into crisp blue and cream stripes.',
      nodes: [
        node('screenUv', 'input/screen-uv'),
        node('screenAxes', 'vector/split'),
        reader('stripeDensity', 'stripeDensity'),
        node('stripePhase', 'math/multiply'),
        node('stripeWave', 'math/sin'),
        node('stripeMask', 'interpolation/aa-step', { edge: float(0) }),
        reader('stripeBlue', 'blue'),
        reader('stripeCream', 'cream'),
        node('stripes', 'interpolation/lerp'),
      ],
    },
    {
      id: 'inks',
      title: 'Four inks',
      es: {
        title: 'Cuatro tintas',
        body: 'Cada Select pinta su tinta desde un nivel de luz para arriba: navy, rojo, azul, rayas y crema, de la sombra a la luz.',
      },
      body:
        'Each Select paints its ink from one light level up: navy, red, blue, stripes and ' +
        'cream, from shadow to light.',
      nodes: [
        reader('navy', 'navy'),
        reader('red', 'red'),
        node('inkRed', 'logic/select', { b: float(RED_FROM) }, { op: 'gte' }),
        reader('blue', 'blue'),
        node('inkBlue', 'logic/select', { b: float(BLUE_FROM) }, { op: 'gte' }),
        node('inkStripes', 'logic/select', { b: float(STRIPES_FROM) }, { op: 'gte' }),
        reader('cream', 'cream'),
        node('inkCream', 'logic/select', { b: float(CREAM_FROM) }, { op: 'gte' }),
      ],
    },
    {
      id: 'outline',
      title: 'Outline',
      es: {
        title: 'Contorno',
        body: 'Fresnel crece hacia los bordes que se alejan de vos; AA Step lo corta en una línea navy. Subí outline para afinarla.',
      },
      body:
        'Fresnel grows toward the edges that turn away from you; AA Step cuts it into a navy ' +
        'line. Raise outline to thin it.',
      nodes: [
        node('fresnel', 'effects/fresnel', { power: float(1) }),
        reader('outline', 'outline'),
        node('outlineMask', 'interpolation/aa-step'),
        reader('outlineNavy', 'navy'),
        node('poster', 'interpolation/lerp'),
      ],
    },
  ],
  wires: [
    ...LIGHT_SHADE_WIRES,
    ['position.out', 'wobbleNoise.p'],
    ['wobbleNoise.out', 'wobble.a'],
    ['edgeWobble.out', 'wobble.b'],
    [LIGHT_SHADE_OUT, 'cutShade.a'],
    ['wobble.out', 'cutShade.b'],
    ['screenUv.out', 'screenAxes.in'],
    ['screenAxes.y', 'stripePhase.a'],
    ['stripeDensity.out', 'stripePhase.b'],
    ['stripePhase.out', 'stripeWave.in'],
    ['stripeWave.out', 'stripeMask.in'],
    ['stripeBlue.out', 'stripes.a'],
    ['stripeCream.out', 'stripes.b'],
    ['stripeMask.out', 'stripes.t'],
    ['cutShade.out', 'inkRed.a'],
    ['red.out', 'inkRed.whenTrue'],
    ['navy.out', 'inkRed.whenFalse'],
    ['cutShade.out', 'inkBlue.a'],
    ['blue.out', 'inkBlue.whenTrue'],
    ['inkRed.out', 'inkBlue.whenFalse'],
    ['cutShade.out', 'inkStripes.a'],
    ['stripes.out', 'inkStripes.whenTrue'],
    ['inkBlue.out', 'inkStripes.whenFalse'],
    ['cutShade.out', 'inkCream.a'],
    ['cream.out', 'inkCream.whenTrue'],
    ['inkStripes.out', 'inkCream.whenFalse'],
    ['outline.out', 'outlineMask.edge'],
    ['fresnel.out', 'outlineMask.in'],
    ['inkCream.out', 'poster.a'],
    ['outlineNavy.out', 'poster.b'],
    ['outlineMask.out', 'poster.t'],
    ['poster.out', 'master.baseColor'],
  ],
  master: { params: { lighting: 'unlit' } },
}
