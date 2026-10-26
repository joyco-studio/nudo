import { describe, expect, it } from 'vitest'

import { fallbackLabel } from './fallback-label'

describe('fallbackLabel', () => {
  it('names the mesh defaults an unconnected input reads from', () => {
    expect(fallbackLabel('uv')).toBe('Mesh UV')
    expect(fallbackLabel('normalView')).toBe('View normal')
    expect(fallbackLabel('positionViewDirection')).toBe('View dir')
    expect(fallbackLabel('screenUV')).toBe('Screen UV')
  })
})
