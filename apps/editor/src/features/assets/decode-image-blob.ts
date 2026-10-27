import { RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import type { Texture } from 'three'

/**
 * Decodes an image file into a texture. The object URL stays alive for as long as the texture
 * does: the thumbnail in the texture field reads it back from the image element.
 */
export async function decodeImageBlob(file: Blob): Promise<Texture> {
  const url = URL.createObjectURL(file)
  try {
    const texture = await new TextureLoader().loadAsync(url)
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    return texture
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}
