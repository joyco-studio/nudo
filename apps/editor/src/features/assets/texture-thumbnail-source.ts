import type { Texture } from 'three'

export interface ImageSize {
  readonly width: number
  readonly height: number
}

/** The URL of the image a loaded texture shows, or `null` for a texture drawn from raw data. */
export function textureThumbnailSource(texture: Texture): string | null {
  const image: unknown = texture.image
  return image instanceof HTMLImageElement ? image.src : null
}

/** The decoded pixel size of an image texture, or `null` when it is not a decoded image. */
export function textureImageSize(texture: Texture): ImageSize | null {
  const image: unknown = texture.image
  if (!(image instanceof HTMLImageElement)) return null
  const { naturalWidth: width, naturalHeight: height } = image
  return width > 0 && height > 0 ? { width, height } : null
}

export function formatImageSize({ width, height }: ImageSize): string {
  return `${String(width)} × ${String(height)}`
}
