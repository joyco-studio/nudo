import { convertValue, float, getConversion, vec2, vec3, vec4 } from '@nudo-tsl/core'
import type { Conversion, VectorType } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { es } from '@/i18n/messages/es'
import { createTranslator, translateEnglish } from '@/i18n/translate'

import { describeConversion } from './describe-conversion'

function conversionOf(from: VectorType, to: VectorType): Conversion {
  const check = getConversion(from, to)
  if (!check.ok || check.conversion === null) throw new Error(`No conversion ${from} → ${to}`)
  return check.conversion
}

describe('describeConversion', () => {
  it.each([
    ['vec2', 'Converted from float to vec2: the value is copied into x and y.'],
    ['vec3', 'Converted from float to vec3: the value is copied into x, y and z.'],
    ['vec4', 'Converted from float to vec4: the value is copied into x, y, z and w.'],
  ] as const)('float widens to %s by copying the value', (to, expected) => {
    expect(describeConversion(conversionOf('float', to), translateEnglish)).toBe(expected)
  })

  it.each([
    ['vec2', 'float', 'Converted from vec2 to float: only x is kept, y is dropped.'],
    ['vec3', 'float', 'Converted from vec3 to float: only x is kept, y and z are dropped.'],
    ['vec4', 'float', 'Converted from vec4 to float: only x is kept, y, z and w are dropped.'],
    ['vec3', 'vec2', 'Converted from vec3 to vec2: x and y are kept, z is dropped.'],
    ['vec4', 'vec2', 'Converted from vec4 to vec2: x and y are kept, z and w are dropped.'],
    ['vec4', 'vec3', 'Converted from vec4 to vec3: x, y and z are kept, w is dropped.'],
  ] as const)('%s narrows to %s by keeping the first components', (from, to, expected) => {
    expect(describeConversion(conversionOf(from, to), translateEnglish)).toBe(expected)
  })

  it.each([
    ['vec2', 'vec3', 'Converted from vec2 to vec3: x and y are kept, z is set to 0.'],
    ['vec2', 'vec4', 'Converted from vec2 to vec4: x and y are kept, z is set to 0 and w to 1.'],
    ['vec3', 'vec4', 'Converted from vec3 to vec4: x, y and z are kept, w is set to 1.'],
  ] as const)('%s widens to %s by filling the new components', (from, to, expected) => {
    expect(describeConversion(conversionOf(from, to), translateEnglish)).toBe(expected)
  })

  it('says it in Spanish, with the components quoted apart from the conjunction', () => {
    const t = createTranslator(es)
    expect(describeConversion(conversionOf('float', 'vec2'), t)).toBe(
      'Convertido de float a vec2: el valor se copia en «x» y «y».',
    )
    expect(describeConversion(conversionOf('vec4', 'float'), t)).toBe(
      'Convertido de vec4 a float: solo se conserva «x», se descartan «y», «z» y «w».',
    )
    expect(describeConversion(conversionOf('vec2', 'vec4'), t)).toBe(
      'Convertido de vec2 a vec4: se conservan «x» y «y», «z» pasa a 0 y «w» a 1.',
    )
  })

  // The wording must match what the runtime does to a value, not what one might expect.
  it('matches convertValue for the padded and truncated components', () => {
    expect(convertValue(vec2(0.3, 0.6), 'vec4')).toEqual(vec4(0.3, 0.6, 0, 1))
    expect(convertValue(vec2(0.3, 0.6), 'vec3')).toEqual(vec3(0.3, 0.6, 0))
    expect(convertValue(vec3(0.3, 0.6, 0.9), 'float')).toEqual(float(0.3))
    expect(convertValue(float(0.3), 'vec3')).toEqual(vec3(0.3, 0.3, 0.3))
  })
})
