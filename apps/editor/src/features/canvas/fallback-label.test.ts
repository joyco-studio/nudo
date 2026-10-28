import { describe, expect, it } from 'vitest'

import { es } from '@/i18n/messages/es'
import { createTranslator, translateEnglish } from '@/i18n/translate'

import { fallbackLabel } from './fallback-label'

describe('fallbackLabel', () => {
  it('names the mesh defaults an unconnected input reads from', () => {
    const t = translateEnglish
    expect(t(fallbackLabel('uv'))).toBe('Mesh UV')
    expect(t(fallbackLabel('normalView'))).toBe('View normal')
    expect(t(fallbackLabel('positionViewDirection'))).toBe('View dir')
    expect(t(fallbackLabel('screenUV'))).toBe('Screen UV')
  })

  it('names them in Spanish too', () => {
    const t = createTranslator(es)
    expect(t(fallbackLabel('uv'))).toBe('UV de la malla')
    expect(t(fallbackLabel('cameraPosition'))).toBe('Posición de cámara')
  })
})
