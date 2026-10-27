import { afterEach, describe, expect, it } from 'vitest'

import { INPUT_MODALITY_ATTRIBUTE, isKeyboardModality, trackInputModality } from './input-modality'

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

  it('records a key before a window shortcut that stops it can act on it', () => {
    stop = trackInputModality(document)
    let modalitySeenByShortcut: string | null = null
    const shortcut = (event: KeyboardEvent): void => {
      modalitySeenByShortcut = modality()
      event.stopPropagation()
    }
    window.addEventListener('keydown', shortcut, { capture: true })
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    window.removeEventListener('keydown', shortcut, { capture: true })
    expect(modalitySeenByShortcut).toBe('keyboard')
  })

  it('ignores a press that script fires without a pointer type', () => {
    stop = trackInputModality(document)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    // motion/react's keyboard press and the overlay coordinator's dismissal fire these.
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(modality()).toBe('keyboard')
    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }),
    )
    expect(modality()).toBe('pointer')
  })

  it('tells whether the last press was a key', () => {
    stop = trackInputModality(document)
    expect(isKeyboardModality(document)).toBe(false)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(isKeyboardModality(document)).toBe(true)
    document.dispatchEvent(new Event('pointerdown'))
    expect(isKeyboardModality(document)).toBe(false)
  })

  it('stops tracking when stopped', () => {
    stop = trackInputModality(document)
    stop()
    stop = null
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    expect(modality()).toBeNull()
  })
})
