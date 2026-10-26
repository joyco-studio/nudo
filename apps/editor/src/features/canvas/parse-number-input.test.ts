import { describe, expect, it } from 'vitest'
import { formatNumber, isNumberInput, parseNumberInput, stepNumber } from './parse-number-input'

const PREVIOUS = 0.5

describe('parseNumberInput', () => {
  it.each([
    ['', PREVIOUS],
    ['   ', PREVIOUS],
    ['abc', PREVIOUS],
    ['1e999', PREVIOUS],
    ['-1e999', PREVIOUS],
    ['-', PREVIOUS],
    ['.', PREVIOUS],
    ['1.2.3', PREVIOUS],
    ['0x10', PREVIOUS],
    ['0.25', 0.25],
    ['-3', -3],
    [' 2 ', 2],
    ['.5', 0.5],
    ['1e3', 1000],
  ])('parses %j as %s', (raw, expected) => {
    expect(parseNumberInput(raw, PREVIOUS)).toBe(expected)
  })
})

describe('isNumberInput', () => {
  it('accepts finite decimals and rejects everything else', () => {
    expect(isNumberInput('-0.25')).toBe(true)
    expect(isNumberInput('1e999')).toBe(false)
    expect(isNumberInput('abc')).toBe(false)
    expect(isNumberInput('')).toBe(false)
  })
})

describe('stepNumber', () => {
  it('adds the step without floating point drift', () => {
    expect(stepNumber(0.5, 0.1)).toBe(0.6)
    expect(stepNumber(0.1, 0.2)).toBe(0.3)
    expect(stepNumber(-0.3, 1)).toBe(0.7)
  })
})

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [0.5, '0.5'],
    [-3, '-3'],
    [1 / 3, '0.333'],
    [2.0004, '2'],
  ])('formats %s as %j', (value, expected) => {
    expect(formatNumber(value)).toBe(expected)
  })
})
