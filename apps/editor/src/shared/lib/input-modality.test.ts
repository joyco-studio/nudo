import { afterEach, describe, expect, it } from 'vitest'

import { INPUT_MODALITY_ATTRIBUTE, trackInputModality } from './input-modality'

const modality = () => document.documentElement.getAttribute(INPUT_MODALITY_ATTRIBUTE)

describe('trackInputModality', () => {
  let stop: (() => void) | null = null
  afterEach(() => {
    stop?.()
    stop = null
    document.documentElement.removeAttribute(INPUT_MODALITY_ATTRIBUTE)
  })

  it('records keyboard on a key press and pointer on a press of the pointer', () => {
    stop = trackInputModality(document)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    expect(modality()).toBe('keyboard')
    document.dispatchEvent(new Event('pointerdown'))
    expect(modality()).toBe('pointer')
  })

  it('ignores a modifier pressed alone, which is often part of a pointer gesture', () => {
    stop = trackInputModality(document)
    document.dispatchEvent(new Event('pointerdown'))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(modality()).toBe('pointer')
  })

  it('stops tracking when stopped', () => {
    stop = trackInputModality(document)
    stop()
    stop = null
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    expect(modality()).toBeNull()
  })
})
