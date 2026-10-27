import { DataTexture, Texture } from 'three'
import { describe, expect, it } from 'vitest'

import {
  formatImageSize,
  textureImageSize,
  textureThumbnailSource,
} from './texture-thumbnail-source'

const SOURCE = 'blob:http://localhost/red-swatch'

function imageTexture(width: number, height: number): Texture {
  const image = document.createElement('img')
  image.src = SOURCE
  Object.defineProperty(image, 'naturalWidth', { value: width })
  Object.defineProperty(image, 'naturalHeight', { value: height })
  return new Texture(image)
}

describe('texture thumbnail source', () => {
  it('reads the URL of an image texture', () => {
    expect(textureThumbnailSource(imageTexture(4, 4))).toBe(SOURCE)
  })

  it('has no URL for a texture drawn from raw data', () => {
    expect(textureThumbnailSource(new DataTexture(new Uint8Array(4), 1, 1))).toBeNull()
  })
})

describe('texture image size', () => {
  it('is the decoded size of an image texture', () => {
    expect(textureImageSize(imageTexture(512, 256))).toEqual({ width: 512, height: 256 })
  })

  it('is unknown for a texture drawn from raw data', () => {
    expect(textureImageSize(new DataTexture(new Uint8Array(4), 1, 1))).toBeNull()
  })

  it('is unknown while the image has not decoded', () => {
    expect(textureImageSize(imageTexture(0, 0))).toBeNull()
  })

  it('reads as width by height', () => {
    expect(formatImageSize({ width: 1024, height: 512 })).toBe('1024 × 512')
  })
})
