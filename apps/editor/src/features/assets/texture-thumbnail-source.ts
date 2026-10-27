import type { Texture } from 'three'

/** The URL of the image a loaded texture shows, or `null` for a texture drawn from raw data. */
export function textureThumbnailSource(texture: Texture): string | null {
  const image: unknown = texture.image
  return image instanceof HTMLImageElement ? image.src : null
}
