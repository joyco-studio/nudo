import { describe, expect, it } from 'vitest'

import { IMAGE_ACCEPT, isAcceptedImage } from './accepted-images'

const fileOf = (type: string): Blob => new Blob(['bytes'], { type })

describe('accepted images', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp', 'image/avif'])('accepts %s', (type) => {
    expect(isAcceptedImage(fileOf(type))).toBe(true)
  })

  it.each(['image/gif', 'image/svg+xml', 'application/pdf', ''])('rejects %j', (type) => {
    expect(isAcceptedImage(fileOf(type))).toBe(false)
  })

  it('lists every accepted type for the file picker', () => {
    expect(IMAGE_ACCEPT).toBe('image/png,image/jpeg,image/webp,image/avif')
  })
})
