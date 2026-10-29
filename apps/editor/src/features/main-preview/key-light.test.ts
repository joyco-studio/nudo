import { MAIN_LIGHT_DEFAULTS } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { KEY_LIGHT_INTENSITY, KEY_LIGHT_POSITION } from './key-light'

const DEFAULTS_PRECISION = 6

describe('preview key light', () => {
  it('points the Main Light default direction at the key light', () => {
    const length = Math.hypot(...KEY_LIGHT_POSITION)

    KEY_LIGHT_POSITION.forEach((component, index) => {
      expect(component / length).toBeCloseTo(
        MAIN_LIGHT_DEFAULTS.direction[index] ?? Number.NaN,
        DEFAULTS_PRECISION,
      )
    })
  })

  it('gives the Main Light default color the key light intensity on white', () => {
    expect(MAIN_LIGHT_DEFAULTS.color).toEqual([
      KEY_LIGHT_INTENSITY,
      KEY_LIGHT_INTENSITY,
      KEY_LIGHT_INTENSITY,
    ])
  })
})
