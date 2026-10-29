import type { TemplateTexture } from '../template-texture'
import paperGrainUrl from '../textures/paper-grain.png?url&no-inline'

/**
 * The images templates can bundle, from `examples/textures/`. Each is its own file in the build
 * (`no-inline`: never a data URL inside the main bundle), fetched only when a template that lists
 * it in its spec's `textures` is previewed or opened.
 */

/** Tileable grey paper grain, 256², from `textures/paper-grain.ts`: multiply it over a color. */
export const PAPER_GRAIN: TemplateTexture = {
  id: 'paper-grain',
  file: paperGrainUrl,
  label: 'Paper grain',
}
