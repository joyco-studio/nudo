import { describe, expect, it } from 'vitest'

import { foldForSearch } from './fold-for-search'

describe('foldForSearch', () => {
  it('drops accents and case, so Spanish words match typed without them', () => {
    expect(foldForSearch('Posición')).toBe('posicion')
    expect(foldForSearch('Español')).toBe('espanol')
    expect(foldForSearch('ÁNGULO, Rotación, Lógica')).toBe('angulo, rotacion, logica')
  })

  it('leaves symbols and digits alone', () => {
    expect(foldForSearch('math/sin + Vec2 · ≤')).toBe('math/sin + vec2 · ≤')
  })
})
