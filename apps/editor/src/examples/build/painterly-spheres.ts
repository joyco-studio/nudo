import type { PainterlyConfig } from './painterly'
import { painterlySpec } from './painterly'

/**
 * The spheres of the user's `Shaders_style.blend`, one config each, numbers copied from its node
 * trees: bend Noise, brush Voronoi, base gradient Mapping, paint Mapping and Bright/Contrast,
 * Overlay factor and Color Ramp (positions, and colors as the linear values Blender stores). B-spline
 * ramps become smooth. `light` scales the .blend's measured light and `gloss` stands in for the
 * Principled BSDF's specular, tuned by eye against the .blend's renders. The glass sphere (mat_10) is left out:
 * the .blend renders it empty.
 */

/** The base gradient Mapping most spheres share. */
const TILTED_GRADIENT = {
  location: [1.46, -0.27, 2.79],
  rotation: [-1.221, -0.003, -0.483],
  scale: [1, 1, 1],
} as const

const UNPLACED = { location: [0, 0, 0], rotation: [0, 0, 0] } as const

/** tile_texture_1's dark stripes on near-black, in linear light. */
const STRIPE_TONES = { dark: [0.027, 0.021, 0.034], light: [0.036, 0.032, 0.044] } as const
/** Paint_texture's pastel pink and violet shards. */
const PASTEL_TONES = { dark: [0.392, 0.235, 0.404], light: [0.715, 0.374, 0.638] } as const

/** mat_1: navy bands with blue and lavender light, glowing streaks, no paint. */
export const MIDNIGHT_GLAZE: PainterlyConfig = {
  bend: { scale: 5, detail: 2, amount: 0.733 },
  brush: { scale: 8.9, exponent: 0.5 },
  base: { shape: 'linear', ...TILTED_GRADIENT, grainScale: 607.6, gradient: 0.85 },
  light: 0.85,
  metallic: 0,
  gloss: { strength: 0.6, shininess: 40 },
  ramp: {
    interpolation: 'constant',
    stops: [
      { position: 0.0, color: [0.006, 0.002, 0.068] },
      { position: 0.48, color: [0.02, 0.018, 0.882] },
      { position: 0.527, color: [0.114, 0.118, 0.266] },
      { position: 0.614, color: [0.122, 0.416, 1.0] },
      { position: 0.645, color: [0.76, 0.678, 1.0] },
    ],
  },
  sparkle: { amount: 0.8, scale: 9 },
}

/** art (mat_2): pastel peach, teal and blue over Paint_texture, outlined. */
export const PASTEL_PLANET: PainterlyConfig = {
  bend: { scale: 5, detail: 2, amount: 0.733 },
  brush: { scale: 8.9, exponent: 0.5 },
  base: { shape: 'linear', ...TILTED_GRADIENT, grainScale: 607.6, gradient: 0.85 },
  light: 0.6,
  metallic: 0,
  gloss: { strength: 0.4, shininess: 40 },
  paint: {
    pattern: 'blotches',
    coords: 'uv',
    scale: 1,
    ...UNPLACED,
    stretch: [6.14, 6.14, 6.14],
    ...PASTEL_TONES,
    brightness: 0,
    contrast: -0.78,
    overlay: 0.525,
  },
  ramp: {
    interpolation: 'smooth',
    stops: [
      { position: 0.0, color: [0.014, 0.003, 0.252] },
      { position: 0.841, color: [0.02, 0.018, 0.882] },
      { position: 0.895, color: [0.005, 0.899, 0.319] },
      { position: 0.95, color: [1.0, 0.284, 0.256] },
      { position: 1.0, color: [0.931, 0.905, 0.799] },
    ],
  },
  sparkle: { amount: 0.4, scale: 9 },
  outline: { width: 0.02 },
}

/** mat_3: magenta, coral and blue bands, glowing streaks. */
export const BUBBLEGUM: PainterlyConfig = {
  bend: { scale: 4.7, detail: 2, amount: 0.742 },
  brush: { scale: 8.9, exponent: 0.5 },
  base: { shape: 'linear', ...TILTED_GRADIENT, grainScale: 607.6, gradient: 0.85 },
  light: 1.25,
  metallic: 0,
  gloss: { strength: 0.8, shininess: 200 },
  ramp: {
    interpolation: 'smooth',
    stops: [
      { position: 0.0, color: [0.006, 0.002, 0.068] },
      { position: 0.72, color: [0.758, 0.005, 0.306] },
      { position: 0.764, color: [0.114, 0.118, 0.266] },
      { position: 0.832, color: [1.0, 0.284, 0.256] },
      { position: 0.886, color: [0.014, 0.464, 1.0] },
      { position: 0.955, color: [0.982, 0.638, 0.628] },
    ],
  },
  sparkle: { amount: 0.8, scale: 9 },
}

/** The ramp mat_4 and mat_12 share: navy into ice blue, cream and lilac. */
const ICE_RAMP: PainterlyConfig['ramp'] = {
  interpolation: 'constant',
  stops: [
    { position: 0.0, color: [0.003, 0.001, 0.024] },
    { position: 0.141, color: [0.102, 0.093, 0.181] },
    { position: 0.168, color: [0.711, 0.795, 1.0] },
    { position: 0.318, color: [0.931, 0.905, 0.799] },
    { position: 1.0, color: [0.874, 0.683, 0.899] },
  ],
}

const ICE_PAINT: NonNullable<PainterlyConfig['paint']> = {
  pattern: 'stripes',
  coords: 'generated',
  scale: 6,
  location: [-2.3, 0, 0],
  rotation: [1.248, 0, 0],
  stretch: [12.2, 1, 1],
  ...STRIPE_TONES,
  brightness: 0.98,
  contrast: 2.14,
  overlay: 0.967,
}

/** mat_4: icy speckle from a coarse Voronoi grain, outlined. */
export const FROST_SPECKLE: PainterlyConfig = {
  bend: { scale: 4, detail: 2, amount: 1 },
  brush: { scale: 18.87, exponent: 9.1 },
  base: { shape: 'spherical', ...UNPLACED, scale: [1, 1, 1], grainScale: 100, gradient: 0 },
  light: 1.4,
  metallic: 0,
  gloss: { strength: 0.5, shininess: 200 },
  paint: ICE_PAINT,
  ramp: ICE_RAMP,
  outline: { width: 0.02 },
}

/**
 * mat_12: mat_4's tree, but its base Mapping squashes Y and Z to 0, so the Voronoi grain only
 * varies along X: bands like a gas giant's. Its grain of 100 draws 310 hairline bands that the
 * render aliases into broad ones; a grain of 8 draws the broad ones outright. Outlined.
 */
export const BANDED_GIANT: PainterlyConfig = {
  ...FROST_SPECKLE,
  base: { shape: 'spherical', ...UNPLACED, scale: [-3.1, 0, 0], grainScale: 8, gradient: 0 },
}

/** mat_5: a peach and indigo split under a soft Paint_texture, glowing streaks. */
export const DUSK_GLAZE: PainterlyConfig = {
  bend: { scale: 5, detail: 2, amount: 0.733 },
  brush: { scale: 8.9, exponent: 0.5 },
  base: { shape: 'linear', ...TILTED_GRADIENT, grainScale: 607.6, gradient: 0.85 },
  light: 0.8,
  metallic: 0,
  gloss: { strength: 0.6, shininess: 40 },
  paint: {
    pattern: 'blotches',
    coords: 'uv',
    scale: 1,
    ...UNPLACED,
    stretch: [1, 1, 1],
    ...PASTEL_TONES,
    brightness: 0,
    contrast: -0.61,
    overlay: 0.242,
  },
  ramp: {
    interpolation: 'smooth',
    stops: [
      { position: 0.0, color: [0.014, 0.003, 0.252] },
      { position: 0.87, color: [0.02, 0.018, 0.882] },
      { position: 0.945, color: [0.931, 0.905, 0.799] },
      { position: 0.982, color: [1.0, 0.284, 0.256] },
      { position: 1.0, color: [0.899, 0.706, 0.495] },
    ],
  },
  sparkle: { amount: 0.4, scale: 9 },
}

/** The sketchy metal paint mat_6 and mat_7 share: Bright/Contrast lifts dark strokes to white. */
const METAL_PAINT_PLACEMENT = {
  location: [-2.3, 0, 0],
  rotation: [1.466, 0.295, 0.653],
  stretch: [1.3, 1, 1],
} as const

/** mat_6: black chrome with white sketch strokes. */
export const CHARCOAL_CHROME: PainterlyConfig = {
  bend: { scale: 12.3, detail: 2, amount: 0.517 },
  brush: { scale: -6.2, exponent: 0.5 },
  base: { shape: 'spherical', ...UNPLACED, scale: [1, 1, 1], grainScale: 500, gradient: 0.471 },
  light: 1,
  metallic: 0.923,
  gloss: { strength: 0.3, shininess: 120 },
  paint: {
    pattern: 'strokes',
    coords: 'generated',
    scale: 9,
    ...METAL_PAINT_PLACEMENT,
    stretch: [5, 1, 1],
    dark: [0.01, 0.008, 0.012],
    light: [0.052, 0.049, 0.057],
    brightness: 1.08,
    contrast: 2.18,
    overlay: 0.242,
  },
  ramp: {
    interpolation: 'smooth',
    stops: [
      { position: 0.0, color: [0.003, 0.001, 0.024] },
      { position: 0.241, color: [0.029, 0.024, 0.026] },
      { position: 0.327, color: [1.0, 0.844, 0.995] },
      { position: 0.427, color: [0.931, 0.905, 0.799] },
    ],
  },
}

/** mat_7: misty pewter with pink light and scan lines. */
export const PEWTER_HAZE: PainterlyConfig = {
  bend: { scale: 4, detail: 2, amount: 0.192 },
  brush: { scale: 26.47, exponent: 9.1 },
  base: { shape: 'spherical', ...UNPLACED, scale: [3, 6, 3], grainScale: 500, gradient: 0.288 },
  light: 1,
  metallic: 0.6,
  gloss: { strength: 0.8, shininess: 120 },
  paint: {
    pattern: 'scanlines',
    coords: 'generated',
    scale: 40,
    ...METAL_PAINT_PLACEMENT,
    dark: [0.019, 0.016, 0.025],
    light: [0.022, 0.019, 0.029],
    brightness: 1.08,
    contrast: 2.18,
    overlay: 0.242,
  },
  ramp: {
    interpolation: 'smooth',
    stops: [
      { position: 0.0, color: [0.003, 0.001, 0.024] },
      { position: 0.332, color: [0.26, 0.285, 0.394] },
      { position: 0.368, color: [1.0, 0.844, 0.995] },
      { position: 1.0, color: [0.931, 0.905, 0.799] },
    ],
  },
}

/** mat_9: a dusty rose moon from a radial gradient, matte. */
export const ROSE_MOON: PainterlyConfig = {
  bend: { scale: 4, detail: 2, amount: 0.633 },
  brush: { scale: 3.37, exponent: 0.5 },
  base: {
    shape: 'radial',
    location: [0, 0, 0],
    rotation: [0.017, 0.017, 0],
    scale: [1, 1, 1],
    grainScale: 200,
    gradient: 0.819,
  },
  light: 0.7,
  metallic: 0,
  paint: {
    pattern: 'stripes',
    coords: 'uv',
    scale: 6,
    location: [-2.3, 0, 0],
    rotation: [1.248, 0, 0],
    stretch: [1, 12.6, 1],
    ...STRIPE_TONES,
    brightness: 1.08,
    contrast: 2.37,
    overlay: 0.575,
  },
  ramp: {
    interpolation: 'smooth',
    stops: [
      { position: 0.0, color: [0.024, 0.036, 0.06] },
      { position: 0.232, color: [0.309, 0.146, 0.222] },
      { position: 0.336, color: [0.931, 0.905, 0.799] },
      { position: 0.432, color: [1.0, 0.844, 0.995] },
      { position: 0.473, color: [0.874, 0.683, 0.899] },
    ],
  },
}

/** mat_11: pink metal with dark ink swirls. */
export const INK_SWIRL: PainterlyConfig = {
  bend: { scale: 4, detail: 2, amount: 0.403 },
  brush: { scale: 44.37, exponent: 32 },
  base: { shape: 'linear', ...UNPLACED, scale: [3, 6, 3], grainScale: 1000, gradient: 0.613 },
  light: 1.5,
  metallic: 0.3,
  gloss: { strength: 0.8, shininess: 300 },
  paint: {
    pattern: 'stripes',
    coords: 'generated',
    scale: 6,
    location: [-2.3, 0, 0],
    rotation: [1.248, 0, 0],
    stretch: [1, 1, 1],
    ...STRIPE_TONES,
    brightness: 1.08,
    contrast: 2.18,
    overlay: 0.725,
  },
  ramp: {
    interpolation: 'smooth',
    stops: [
      { position: 0.0, color: [0.003, 0.001, 0.024] },
      { position: 0.391, color: [0.029, 0.024, 0.026] },
      { position: 0.405, color: [0.931, 0.905, 0.799] },
      { position: 0.427, color: [0.874, 0.683, 0.899] },
    ],
  },
}

/** leafs: night green and navy with a pink rim of light. */
export const NIGHT_LEAF: PainterlyConfig = {
  bend: { scale: 4.7, detail: 2, amount: 0.742 },
  brush: { scale: 8.9, exponent: 0.5 },
  base: { shape: 'linear', ...TILTED_GRADIENT, grainScale: 607.6, gradient: 0.85 },
  light: 0.95,
  metallic: 0,
  gloss: { strength: 0.5, shininess: 200 },
  paint: {
    pattern: 'stripes',
    coords: 'uv',
    scale: 6,
    ...UNPLACED,
    stretch: [1, 1, 1],
    ...STRIPE_TONES,
    brightness: 1.08,
    contrast: 2.18,
    overlay: 0.532,
  },
  ramp: {
    interpolation: 'smooth',
    stops: [
      { position: 0.0, color: [0, 0, 0] },
      { position: 0.585, color: [0.006, 0.002, 0.068] },
      { position: 0.659, color: [0.114, 0.118, 0.266] },
      { position: 0.889, color: [0, 0.368, 0.004] },
      { position: 1.0, color: [0.982, 0.638, 0.628] },
    ],
  },
}

export const MIDNIGHT_GLAZE_SPEC = painterlySpec(MIDNIGHT_GLAZE)
export const PASTEL_PLANET_SPEC = painterlySpec(PASTEL_PLANET)
export const BUBBLEGUM_SPEC = painterlySpec(BUBBLEGUM)
export const FROST_SPECKLE_SPEC = painterlySpec(FROST_SPECKLE)
export const BANDED_GIANT_SPEC = painterlySpec(BANDED_GIANT)
export const DUSK_GLAZE_SPEC = painterlySpec(DUSK_GLAZE)
export const CHARCOAL_CHROME_SPEC = painterlySpec(CHARCOAL_CHROME)
export const PEWTER_HAZE_SPEC = painterlySpec(PEWTER_HAZE)
export const ROSE_MOON_SPEC = painterlySpec(ROSE_MOON)
export const INK_SWIRL_SPEC = painterlySpec(INK_SWIRL)
export const NIGHT_LEAF_SPEC = painterlySpec(NIGHT_LEAF)
