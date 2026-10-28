import { describe, expect, it } from 'vitest'

import { es } from '@/i18n/messages/es'
import { createTranslator, translateEnglish } from '@/i18n/translate'

import { backdropOptions } from './backdrop-field'

describe('backdropOptions', () => {
  it('lists None, Grid and Checker room in English', () => {
    expect(backdropOptions(translateEnglish)).toEqual([
      { value: 'none', label: 'None' },
      { value: 'grid', label: 'Grid' },
      { value: 'checker-room', label: 'Checker room' },
    ])
  })

  it('names the grid in Spanish', () => {
    const grid = backdropOptions(createTranslator(es)).find((option) => option.value === 'grid')
    expect(grid?.label).toBe('Grilla')
  })
})
