import { describe, expect, it } from 'vitest'

import { areaAxisForKey, fractionAlong, valueForKey } from './slider-input'

const PERCENT = { min: 0, max: 100, step: 1, largeStep: 10 } as const

describe('valueForKey', () => {
  it('steps by one with the arrows and by the large step with Shift', () => {
    expect(valueForKey('ArrowRight', false, 40, PERCENT)).toBe(41)
    expect(valueForKey('ArrowUp', false, 40, PERCENT)).toBe(41)
    expect(valueForKey('ArrowLeft', false, 40, PERCENT)).toBe(39)
    expect(valueForKey('ArrowDown', true, 40, PERCENT)).toBe(30)
  })

  it('steps from the nearest whole value', () => {
    expect(valueForKey('ArrowRight', false, 40.6, PERCENT)).toBe(42)
  })

  it('jumps a large step with Page Up and Page Down, and to the ends with Home and End', () => {
    expect(valueForKey('PageUp', false, 40, PERCENT)).toBe(50)
    expect(valueForKey('PageDown', false, 40, PERCENT)).toBe(30)
    expect(valueForKey('Home', false, 40, PERCENT)).toBe(0)
    expect(valueForKey('End', false, 40, PERCENT)).toBe(100)
  })

  it('stays inside the range', () => {
    expect(valueForKey('ArrowRight', true, 95, PERCENT)).toBe(100)
    expect(valueForKey('ArrowLeft', false, 0, PERCENT)).toBe(0)
  })

  it('ignores keys that do not move a slider', () => {
    expect(valueForKey('Enter', false, 40, PERCENT)).toBeNull()
    expect(valueForKey('a', false, 40, PERCENT)).toBeNull()
  })
})

describe('areaAxisForKey', () => {
  it('maps the horizontal keys to x and the vertical keys to y', () => {
    expect(areaAxisForKey('ArrowLeft')).toBe('x')
    expect(areaAxisForKey('ArrowRight')).toBe('x')
    expect(areaAxisForKey('Home')).toBe('x')
    expect(areaAxisForKey('End')).toBe('x')
    expect(areaAxisForKey('ArrowUp')).toBe('y')
    expect(areaAxisForKey('ArrowDown')).toBe('y')
    expect(areaAxisForKey('PageUp')).toBe('y')
    expect(areaAxisForKey('PageDown')).toBe('y')
    expect(areaAxisForKey('Tab')).toBeNull()
  })
})

describe('fractionAlong', () => {
  it('maps a pointer position to 0..1 along a track', () => {
    expect(fractionAlong(150, 100, 200)).toBe(0.25)
    expect(fractionAlong(50, 100, 200)).toBe(0)
    expect(fractionAlong(400, 100, 200)).toBe(1)
  })

  it('returns 0 for a track with no length', () => {
    expect(fractionAlong(150, 100, 0)).toBe(0)
  })
})
