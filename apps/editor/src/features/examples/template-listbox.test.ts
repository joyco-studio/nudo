import { describe, expect, it } from 'vitest'

import {
  EMPTY_TYPEAHEAD,
  isTypeaheadKey,
  moveSelection,
  nextTypeahead,
  typeaheadIndex,
} from './template-listbox'

const TITLES = ['Lettra pond', 'Simple water', 'Iridescent blob', 'Soft sand'] as const
const RESET_MS = 500

describe('moveSelection', () => {
  it('steps down and up one option, stopping at the ends', () => {
    expect(moveSelection('ArrowDown', 0, 3)).toBe(1)
    expect(moveSelection('ArrowDown', 2, 3)).toBe(2)
    expect(moveSelection('ArrowUp', 1, 3)).toBe(0)
    expect(moveSelection('ArrowUp', 0, 3)).toBe(0)
  })

  it('jumps to the first and last option with Home and End', () => {
    expect(moveSelection('Home', 2, 3)).toBe(0)
    expect(moveSelection('End', 0, 3)).toBe(2)
  })

  it('leaves every other key to the caller', () => {
    expect(moveSelection('Enter', 1, 3)).toBeNull()
    expect(moveSelection('ArrowLeft', 1, 3)).toBeNull()
    expect(moveSelection('a', 1, 3)).toBeNull()
  })

  it('has nothing to select in an empty list', () => {
    expect(moveSelection('ArrowDown', 0, 0)).toBeNull()
  })
})

describe('typeaheadIndex', () => {
  it('finds the first title that starts with the typed text, from the current option on', () => {
    expect(typeaheadIndex(TITLES, 'iri', 0)).toBe(2)
    expect(typeaheadIndex(TITLES, 'lettra', 3)).toBe(0)
  })

  it('stays on the current option while it still matches a longer query', () => {
    expect(typeaheadIndex(TITLES, 'si', 1)).toBe(1)
  })

  it('cycles through the titles that start with a letter typed again and again', () => {
    expect(typeaheadIndex(TITLES, 's', 1)).toBe(3)
    expect(typeaheadIndex(TITLES, 'ss', 3)).toBe(1)
  })

  it('ignores case and accents', () => {
    expect(typeaheadIndex(['Estanque de Lettra', 'Agua simple'], 'ÁGUA', 0)).toBe(1)
  })

  it('finds nothing for text no title starts with', () => {
    expect(typeaheadIndex(TITLES, 'zz', 0)).toBeNull()
    expect(typeaheadIndex(TITLES, '', 0)).toBeNull()
  })
})

describe('nextTypeahead', () => {
  it('adds a printable key to the query while keys come quickly', () => {
    const first = nextTypeahead(EMPTY_TYPEAHEAD, 's', 1000, RESET_MS)
    const second = nextTypeahead(first, 'i', 1200, RESET_MS)
    expect(second.query).toBe('si')
  })

  it('starts over after a pause', () => {
    const first = nextTypeahead(EMPTY_TYPEAHEAD, 's', 1000, RESET_MS)
    expect(nextTypeahead(first, 'i', 1000 + RESET_MS + 1, RESET_MS).query).toBe('i')
  })

  it('keeps a space inside a query, but a space alone types nothing', () => {
    const first = nextTypeahead(EMPTY_TYPEAHEAD, 's', 1000, RESET_MS)
    expect(isTypeaheadKey(' ', first)).toBe(true)
    expect(isTypeaheadKey(' ', EMPTY_TYPEAHEAD)).toBe(false)
  })

  it('takes printable keys only', () => {
    expect(isTypeaheadKey('a', EMPTY_TYPEAHEAD)).toBe(true)
    expect(isTypeaheadKey('ArrowDown', EMPTY_TYPEAHEAD)).toBe(false)
    expect(isTypeaheadKey('Enter', EMPTY_TYPEAHEAD)).toBe(false)
  })
})
