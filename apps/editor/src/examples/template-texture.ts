import { texture } from '@nudo-tsl/core'
import type { PortValue } from '@nudo-tsl/core'

/**
 * An image a template ships with. It is bundled with the editor as its own file and fetched only
 * when the template is previewed or opened. The template's graph names it with `templateTexture`
 * in a texture slot or a texture property; opening the template stores the image like an upload
 * and points those slots at the stored asset.
 */
export interface TemplateTexture {
  /** The name the template's graph uses for it, kebab-case: `templateTexture('paper-grain')`. */
  readonly id: string
  /** The bundled file's URL: `import url from '../textures/name.png?url&no-inline'`. */
  readonly file: string
  /** What the image is, in a few words (English, like property labels). */
  readonly label: string
}

/** Marks an asset id as a template's texture, not yet stored; real ids are hex SHA-256. */
const TEMPLATE_TEXTURE_PREFIX = 'template:'

/** The asset id a template's graph stores for one of its textures until the template opens. */
export const templateTextureRef = (id: string): string => `${TEMPLATE_TEXTURE_PREFIX}${id}`

/** The template texture an asset id names, or null for a stored asset or an empty slot. */
export function templateTextureIdOf(assetId: string | null): string | null {
  if (assetId === null || !assetId.startsWith(TEMPLATE_TEXTURE_PREFIX)) return null
  return assetId.slice(TEMPLATE_TEXTURE_PREFIX.length)
}

/**
 * A texture value for a template's spec: the template's texture `id`, bound when it opens. Marked
 * pure so a spec nobody reads (a test fixture in a production build) drops out of the bundle.
 */
/* #__NO_SIDE_EFFECTS__ */
export function templateTexture(id: string): PortValue {
  return texture(templateTextureRef(id))
}
