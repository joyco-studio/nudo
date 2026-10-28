import { describe, expect, it } from 'vitest'

import { isStructurallyEqual } from './structurally-equal'

describe('isStructurallyEqual', () => {
  it('compares primitives by value, NaN included', () => {
    expect(isStructurallyEqual(1, 1)).toBe(true)
    expect(isStructurallyEqual('a', 'b')).toBe(false)
    expect(isStructurallyEqual(Number.NaN, Number.NaN)).toBe(true)
    expect(isStructurallyEqual(undefined, null)).toBe(false)
  })

  it('compares plain objects and arrays by their contents, at any depth', () => {
    expect(isStructurallyEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true)
    expect(isStructurallyEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false)
    expect(isStructurallyEqual([1, 2], [1, 2, 3])).toBe(false)
    expect(isStructurallyEqual([1], { 0: 1 })).toBe(false)
  })

  it('tells a missing key from one set to undefined', () => {
    expect(isStructurallyEqual({ a: undefined }, {})).toBe(false)
    expect(isStructurallyEqual({}, { a: undefined })).toBe(false)
  })

  it('compares sets by their members', () => {
    expect(isStructurallyEqual(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true)
    expect(isStructurallyEqual(new Set(['a']), new Set(['a', 'b']))).toBe(false)
    expect(isStructurallyEqual(new Set(['a']), ['a'])).toBe(false)
  })

  it('compares functions and class instances by identity', () => {
    const run = (): number => 1
    expect(isStructurallyEqual({ run }, { run })).toBe(true)
    expect(isStructurallyEqual({ run }, { run: (): number => 1 })).toBe(false)
    expect(isStructurallyEqual(new Date(0), new Date(0))).toBe(false)
  })
})
