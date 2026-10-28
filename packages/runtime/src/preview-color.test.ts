import type { TslFacade } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import { toPreviewColor, toPreviewValue } from './preview-color'

/** Records every call as text so the shape of the resulting expression can be asserted. */
const recordingFacade: Pick<
  TslFacade<string>,
  'construct' | 'swizzle' | 'textureSample' | 'builtin'
> = {
  construct: (type, parts) => `${type}(${parts.join(', ')})`,
  swizzle: (value, components) => `${value}.${components}`,
  textureSample: (texture, uv, level) => `sample(${texture}, ${uv}, ${level ?? 'auto'})`,
  builtin: (name) => name,
}

describe('toPreviewColor', () => {
  it('shows a float as grey', () => {
    expect(toPreviewColor(recordingFacade, 'f', 'float')).toBe('vec3(f, f, f)')
  })

  it('preview material for a vec2 output maps to (x,y,0)', () => {
    expect(toPreviewColor(recordingFacade, 'p', 'vec2')).toBe('vec3(p, 0)')
  })

  it('passes a vec3 through unchanged', () => {
    expect(toPreviewColor(recordingFacade, 'c', 'vec3')).toBe('c')
  })

  it('drops the alpha of a vec4', () => {
    expect(toPreviewColor(recordingFacade, 'c', 'vec4')).toBe('c.xyz')
  })

  it('shows a texture by its rgb at the mesh UV', () => {
    expect(toPreviewColor(recordingFacade, 't', 'texture')).toBe('sample(t, uv, auto).xyz')
  })
})

describe('toPreviewValue', () => {
  const fractFacade: Pick<TslFacade<string>, 'fract'> = { fract: (value) => `fract(${value})` }

  it('loops an output that only grows (repeat) through its fractional part', () => {
    expect(toPreviewValue(fractFacade, 't', 'repeat')).toBe('fract(t)')
  })

  it('shows every other output as it is', () => {
    expect(toPreviewValue(fractFacade, 'v', undefined)).toBe('v')
  })
})
