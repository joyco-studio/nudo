import { describe, expect, it } from 'vitest'

import { isTextEntry } from './is-text-entry'

describe('isTextEntry', () => {
  it('is true for inputs, textareas, selects and content-editable elements', () => {
    const editable = document.createElement('div')
    // jsdom does not implement isContentEditable, so it is defined the way a browser reports it.
    Object.defineProperty(editable, 'isContentEditable', { value: true })

    expect(isTextEntry(document.createElement('input'))).toBe(true)
    expect(isTextEntry(document.createElement('textarea'))).toBe(true)
    expect(isTextEntry(document.createElement('select'))).toBe(true)
    expect(isTextEntry(editable)).toBe(true)
  })

  it('is false for other elements and for non-elements', () => {
    expect(isTextEntry(document.createElement('button'))).toBe(false)
    expect(isTextEntry(document.createElement('div'))).toBe(false)
    expect(isTextEntry(window)).toBe(false)
    expect(isTextEntry(null)).toBe(false)
  })
})
