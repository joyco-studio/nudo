import { DataTexture, RGBAFormat, UnsignedByteType } from 'three'
import type { Texture } from 'three'

export interface MaterialOptions {
  /** The texture for an asset id, or `null` when the asset is not available. */
  resolveTexture(assetId: string): Texture | null
}

const NEUTRAL_GREY = 128
const OPAQUE_ALPHA = 255

let neutralTexture: DataTexture | null = null

/** The shared 1x1 stand-in (0.5 grey, opaque) for a texture that is unassigned or unavailable. */
export function getNeutralTexture(): DataTexture {
  if (neutralTexture !== null) return neutralTexture
  const pixel = new Uint8Array([NEUTRAL_GREY, NEUTRAL_GREY, NEUTRAL_GREY, OPAQUE_ALPHA])
  neutralTexture = new DataTexture(pixel, 1, 1, RGBAFormat, UnsignedByteType)
  neutralTexture.needsUpdate = true
  return neutralTexture
}

export interface TextureResolver {
  /** Never fails: an unassigned or unavailable asset resolves to the neutral texture. */
  resolve(assetId: string | null): Texture
  /** Asset ids that were asked for but could not be resolved. */
  readonly missing: ReadonlySet<string>
}

export function createTextureResolver(options: MaterialOptions | undefined): TextureResolver {
  const missing = new Set<string>()
  return {
    missing,
    resolve: (assetId) => {
      if (assetId === null) return getNeutralTexture()
      const resolved = options?.resolveTexture(assetId) ?? null
      if (resolved !== null) return resolved
      missing.add(assetId)
      return getNeutralTexture()
    },
  }
}
