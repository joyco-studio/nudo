/** Image formats a texture can be made from. */
export const ACCEPTED_IMAGE_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
]

/** The value for a file input's `accept` attribute. */
export const IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(',')

export const ACCEPTED_IMAGES_HINT = 'Use a PNG, JPG, WebP or AVIF image.'

export function isAcceptedImage(file: Blob): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type)
}
