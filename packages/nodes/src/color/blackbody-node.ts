import { concrete, defineNode, float } from '@nudo-tsl/core'
import type { TslFacade } from '@nudo-tsl/core'

/**
 * Where Krystek's approximation of the Planckian locus holds (M. Krystek, "An algorithm to
 * calculate correlated colour temperature", 1985): 1000 K to 15000 K.
 */
export const BLACKBODY_MIN_KELVIN = 1000
export const BLACKBODY_MAX_KELVIN = 15000
const DEFAULT_KELVIN = 1500

/** Krystek's rational fits of the CIE 1960 (u, v) chromaticity, as [constant, T, T²] terms. */
const U_NUMERATOR = [0.860117757, 1.54118254e-4, 1.28641212e-7] as const
const U_DENOMINATOR = [1, 8.42420235e-4, 7.08145163e-7] as const
const V_NUMERATOR = [0.317398726, 4.22806245e-5, 4.20481691e-8] as const
const V_DENOMINATOR = [1, -2.89741816e-5, 1.61456053e-7] as const

/** CIE XYZ to linear sRGB (Rec. 709 primaries, D65 white), row by row. */
const XYZ_TO_LINEAR_SRGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.969266, 1.8760108, 0.041556],
  [0.0556434, -0.2040259, 1.0572252],
] as const

type Quadratic = readonly [number, number, number]

/** a + b·T + c·T², from the facade. */
function quadratic<E>(tsl: TslFacade<E>, [a, b, c]: Quadratic, kelvin: E): E {
  const constant = (value: number): E => tsl.construct('float', [value])
  return tsl.add(
    tsl.add(constant(a), tsl.mul(constant(b), kelvin)),
    tsl.mul(constant(c), tsl.mul(kelvin, kelvin)),
  )
}

/**
 * The color of a black body at `kelvin`, in linear sRGB, scaled so its brightest channel is 1:
 * Krystek's (u, v) to xy, then to XYZ at Y = 1, then to linear sRGB; channels a deep red or a
 * hot blue would take below 0 are clipped. A pure color: multiply it for brightness.
 */
export function blackbodyColor<E>(tsl: TslFacade<E>, temperature: E): E {
  const constant = (value: number): E => tsl.construct('float', [value])
  const kelvin = tsl.clamp(
    temperature,
    constant(BLACKBODY_MIN_KELVIN),
    constant(BLACKBODY_MAX_KELVIN),
  )
  const u = tsl.div(quadratic(tsl, U_NUMERATOR, kelvin), quadratic(tsl, U_DENOMINATOR, kelvin))
  const v = tsl.div(quadratic(tsl, V_NUMERATOR, kelvin), quadratic(tsl, V_DENOMINATOR, kelvin))
  // CIE 1960 (u, v) to CIE 1931 (x, y): x = 3u / d, y = 2v / d, d = 2u − 8v + 4.
  const d = tsl.add(tsl.sub(tsl.mul(constant(2), u), tsl.mul(constant(8), v)), constant(4))
  const x = tsl.div(tsl.mul(constant(3), u), d)
  const y = tsl.div(tsl.mul(constant(2), v), d)
  // XYZ at a luminance of 1.
  const xyz = [tsl.div(x, y), constant(1), tsl.div(tsl.sub(tsl.sub(constant(1), x), y), y)] as const
  const [red, green, blue] = XYZ_TO_LINEAR_SRGB.map(([fromX, fromY, fromZ]) =>
    tsl.max(
      tsl.add(
        tsl.add(tsl.mul(constant(fromX), xyz[0]), tsl.mul(constant(fromY), xyz[1])),
        tsl.mul(constant(fromZ), xyz[2]),
      ),
      constant(0),
    ),
  )
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error('Blackbody needs three channels')
  }
  const brightest = tsl.max(tsl.max(red, green), blue)
  return tsl.div(tsl.construct('vec3', [red, green, blue]), brightest)
}

export const blackbodyNode = defineNode({
  type: 'color/blackbody',
  category: 'color',
  label: 'Blackbody',
  description:
    'The color of something glowing from heat: deep red embers at 1000 K, candle orange near 1900 K, white near 6500 K, blue above.',
  formula: 'planck(Temperature)',
  keywords: ['blackbody', 'temperature', 'kelvin', 'heat', 'glow', 'fire', 'lava', 'incandescent'],
  inputs: [
    {
      id: 'temperature',
      label: 'Temperature',
      type: concrete('float'),
      default: float(DEFAULT_KELVIN),
      description:
        'How hot, in kelvin, as on a light bulb box: 1000 to 15000. Lava glows at 1000 to 1500.',
    },
  ],
  outputs: [
    {
      id: 'color',
      label: 'Color',
      type: concrete('vec3'),
      description:
        'The glow color in linear light, its brightest channel at 1: multiply it to make it shine.',
    },
  ],
  build: ({ tsl, inputs }) => ({ color: blackbodyColor(tsl, inputs.temperature) }),
})
