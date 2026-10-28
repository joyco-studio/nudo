import type { DataType, OutputPreview, TslFacade } from '@nudo-tsl/core'

type PreviewFacade<E> = Pick<TslFacade<E>, 'construct' | 'swizzle' | 'textureSample' | 'builtin'>

/**
 * A port's value as a vec3 color for display: a float is grey, a vec2 is (x, y, 0), a vec4 drops
 * its alpha, and a texture shows its rgb at the mesh UV.
 */
export function toPreviewColor<E>(tsl: PreviewFacade<E>, value: E, type: DataType): E {
  switch (type) {
    case 'float':
      return tsl.construct('vec3', [value, value, value])
    case 'vec2':
      return tsl.construct('vec3', [value, 0])
    case 'vec3':
      return value
    case 'vec4':
      return tsl.swizzle(value, 'xyz')
    case 'texture':
      return tsl.swizzle(tsl.textureSample(value, tsl.builtin('uv'), null), 'xyz')
  }
}

/**
 * Applies an output's preview hint before it is shown: `repeat` loops a value that only grows
 * (seconds) through its fractional part. Display only, so materials and code never see it.
 */
export function toPreviewValue<E>(
  tsl: Pick<TslFacade<E>, 'fract'>,
  value: E,
  preview: OutputPreview | undefined,
): E {
  return preview === 'repeat' ? tsl.fract(value) : value
}
