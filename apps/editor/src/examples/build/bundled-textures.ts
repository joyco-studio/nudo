import type { TemplateTexture } from '../template-texture'
import botanicalWallpaperUrl from '../textures/botanical-sage-wallpaper.png?url&no-inline'
import brushStrokeUrl from '../textures/brush-stroke.png?url&no-inline'
import paperGrainUrl from '../textures/paper-grain.png?url&no-inline'
import concreteWallUrl from '../textures/light-concrete-wall.png?url&no-inline'
import strokeMaskUrl from '../textures/stroke-mask.png?url&no-inline'
import tearShapeUrl from '../textures/tear-shape-sdf.png?url&no-inline'

/**
 * The images templates can bundle, from `examples/textures/`. Each is its own file in the build
 * (`no-inline`: never a data URL inside the main bundle), fetched only when a template that lists
 * it in its spec's `textures` is previewed or opened.
 */

/** Tileable grey paper grain, 256², from `textures/paper-grain.ts`: multiply it over a color. */
export const PAPER_GRAIN: TemplateTexture = {
  id: 'paper-grain',
  file: paperGrainUrl,
  label: 'templateTexture.paper-grain',
}

/** Generated botanical print, also published at r2.joyco.studio/nudo/wallpapers/botanical-sage-01a1a1d4.png. */
export const BOTANICAL_WALLPAPER: TemplateTexture = {
  id: 'botanical-sage-wallpaper',
  file: botanicalWallpaperUrl,
  label: 'templateTexture.botanical-sage-wallpaper',
}

/** Generated pale concrete albedo for the exposed wall behind torn wallpaper. */
export const CONCRETE_WALL: TemplateTexture = {
  id: 'light-concrete-wall',
  file: concreteWallUrl,
  label: 'templateTexture.light-concrete-wall',
}

/** Single-channel SDF: white inside, 0.5 boundary, encoded range 256 / 512 = 0.5 UV. */
export const TEAR_SHAPE: TemplateTexture = {
  id: 'tear-shape-sdf',
  file: tearShapeUrl,
  label: 'templateTexture.tear-shape-sdf',
}

/**
 * Overlapping flat-brush strokes in many greys, 512², from `textures/paint-strokes.ts`: ragged
 * sides, bristle streaks and dry-brush gaps. Tiles without a seam.
 */
export const BRUSH_STROKE: TemplateTexture = {
  id: 'brush-stroke',
  file: brushStrokeUrl,
  label: 'templateTexture.brush-stroke',
}

/**
 * White brush strokes over black, nearly binary, 256², from `textures/paint-strokes.ts`: an alpha
 * mask whose dark gaps bite a silhouette. Tiles without a seam.
 */
export const STROKE_MASK: TemplateTexture = {
  id: 'stroke-mask',
  file: strokeMaskUrl,
  label: 'templateTexture.stroke-mask',
}
