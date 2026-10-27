import type { HelperName } from './code-expression'

/** A local `Fn` a generated module declares, with the `three/tsl` names its body uses. */
export interface TslHelper {
  readonly imports: readonly string[]
  readonly source: string
}

/**
 * These sources mirror the live runtime's helpers (`packages/runtime/src/simplex-noise.ts`,
 * `normal-from-height.ts` and `scene-depth-fade.ts`) minus their type annotations. A parity test
 * compares them with the runtime files, so a change on one side must be made on the other.
 */
const SIMPLEX_NOISE_SOURCE = `/**
 * 3D simplex noise, ported from Ian McEwan, Ashima Arts (MIT, "webgl-noise") after Stefan
 * Gustavson's reference implementation. Returns a float in roughly [-1, 1].
 */

const SKEW_FACTOR = 1 / 3
const UNSKEW_FACTOR = 1 / 6
const MOD_289_PERIOD = 289
const PERMUTE_MULTIPLIER = 34
const PERMUTE_OFFSET = 1
const GRADIENT_GRID_SIZE = 7
const GRADIENT_GRID_CELLS = GRADIENT_GRID_SIZE * GRADIENT_GRID_SIZE
const GRADIENT_SCALE = 2 / GRADIENT_GRID_SIZE
const GRADIENT_OFFSET = 1 / (2 * GRADIENT_GRID_SIZE) - 1
const TAYLOR_INVERSE_SQRT_OFFSET = 1.79284291400159
const TAYLOR_INVERSE_SQRT_SLOPE = 0.85373472095314
const FALLOFF_RADIUS = 0.6
const OUTPUT_SCALE = 42
const HALF = 0.5
/**
 * The gradient grid places some points exactly on the octahedron's equator (height 0), where
 * rounding decides which hemisphere they fall in. Real heights are multiples of 1/14, so this
 * margin only settles those ties, the same way on every GPU.
 */
const EQUATOR_TOLERANCE = 0.001

/**
 * Largest integer multiple of 'period' not above 'value', for integral 'value'. Nudging by half a
 * unit keeps the division away from an integer boundary, where a rounded reciprocal product could
 * land just below it and make the hash differ between GPUs.
 */
const integerQuotient = (value, period) => floor(value.add(HALF).mul(1 / period))

const mod289 = (x) => x.sub(integerQuotient(x, MOD_289_PERIOD).mul(MOD_289_PERIOD))

const permute = (x) => mod289(x.mul(PERMUTE_MULTIPLIER).add(PERMUTE_OFFSET).mul(x))

const taylorInverseSqrt = (r) => r.mul(-TAYLOR_INVERSE_SQRT_SLOPE).add(TAYLOR_INVERSE_SQRT_OFFSET)

const simplexNoise3 = Fn(([pointInput]) => {
  const point = vec3(pointInput).toVar()

  // First corner of the simplex cell, then the three other corners.
  const cell = floor(point.add(dot(point, vec3(SKEW_FACTOR)))).toVar()
  const x0 = point
    .sub(cell)
    .add(dot(cell, vec3(UNSKEW_FACTOR)))
    .toVar()

  const greater = step(x0.yzx, x0).toVar()
  const lesser = greater.oneMinus().toVar()
  const i1 = min(greater, lesser.zxy).toVar()
  const i2 = max(greater, lesser.zxy).toVar()

  const x1 = x0.sub(i1).add(UNSKEW_FACTOR).toVar()
  const x2 = x0
    .sub(i2)
    .add(2 * UNSKEW_FACTOR)
    .toVar()
  const x3 = x0.sub(0.5).toVar()

  // Hash the four corners into pseudo-random values.
  const wrappedCell = mod289(vec4(cell, 0)).xyz.toVar()
  const hashed = permute(
    permute(
      permute(vec4(0, i1.z, i2.z, 1).add(wrappedCell.z))
        .add(vec4(0, i1.y, i2.y, 1))
        .add(wrappedCell.y),
    )
      .add(vec4(0, i1.x, i2.x, 1))
      .add(wrappedCell.x),
  ).toVar()

  // Gradients: a 7x7 grid mapped onto an octahedron.
  const cellIndex = hashed
    .sub(integerQuotient(hashed, GRADIENT_GRID_CELLS).mul(GRADIENT_GRID_CELLS))
    .toVar()
  const column = integerQuotient(cellIndex, GRADIENT_GRID_SIZE).toVar()
  const row = cellIndex.sub(column.mul(GRADIENT_GRID_SIZE)).toVar()
  const gridX = column.mul(GRADIENT_SCALE).add(GRADIENT_OFFSET).toVar()
  const gridY = row.mul(GRADIENT_SCALE).add(GRADIENT_OFFSET).toVar()
  const height = vec4(1).sub(abs(gridX)).sub(abs(gridY)).toVar()

  const b0 = vec4(gridX.x, gridX.y, gridY.x, gridY.y).toVar()
  const b1 = vec4(gridX.z, gridX.w, gridY.z, gridY.w).toVar()
  const s0 = floor(b0).mul(2).add(1).toVar()
  const s1 = floor(b1).mul(2).add(1).toVar()
  const lowerHalf = step(height.sub(EQUATOR_TOLERANCE), vec4(0)).negate().toVar()

  const a0 = b0.xzyw.add(s0.xzyw.mul(lowerHalf.xxyy)).toVar()
  const a1 = b1.xzyw.add(s1.xzyw.mul(lowerHalf.zzww)).toVar()

  const g0 = vec3(a0.x, a0.y, height.x).toVar()
  const g1 = vec3(a0.z, a0.w, height.y).toVar()
  const g2 = vec3(a1.x, a1.y, height.z).toVar()
  const g3 = vec3(a1.z, a1.w, height.w).toVar()

  // Normalise the gradients.
  const normalisation = taylorInverseSqrt(vec4(dot(g0, g0), dot(g1, g1), dot(g2, g2), dot(g3, g3)))
  const n0 = g0.mul(normalisation.x)
  const n1 = g1.mul(normalisation.y)
  const n2 = g2.mul(normalisation.z)
  const n3 = g3.mul(normalisation.w)

  // Blend the contribution of each corner.
  const falloff = max(
    vec4(FALLOFF_RADIUS).sub(vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3))),
    0,
  ).toVar()
  const weights = falloff.mul(falloff).toVar()
  const contributions = vec4(dot(n0, x0), dot(n1, x1), dot(n2, x2), dot(n3, x3))

  return dot(weights.mul(weights), contributions).mul(OUTPUT_SCALE)
})`

const NORMAL_FROM_HEIGHT_SOURCE = `/**
 * View-space normal from the screen-space derivatives of a procedural height.
 *
 * three's 'bumpMap' cannot be reused: it differentiates by re-sampling a texture node at shifted
 * UVs, which an arbitrary float expression does not support. This is the same surface-gradient
 * perturbation (Morten S. Mikkelsen, "Bump Mapping Unparametrized Surfaces on the GPU") that
 * 'bumpMap' applies, fed with 'dFdx' / 'dFdy' of the height instead. The view-position
 * derivatives are left unnormalized so the height reads in view-space units: the slope is the
 * height change per unit of distance, independent of the pixel footprint.
 */
const normalFromHeight = Fn(([height, strength]) => {
  const heightGradient = vec2(dFdx(height), dFdy(height)).mul(strength)

  const sigmaX = dFdx(positionView)
  const sigmaY = dFdy(positionView)
  const surfaceNormal = normalView

  const crossY = sigmaY.cross(surfaceNormal)
  const crossX = surfaceNormal.cross(sigmaX)

  const determinant = sigmaX.dot(crossY).mul(faceDirection)
  const surfaceGradient = determinant
    .sign()
    .mul(heightGradient.x.mul(crossY).add(heightGradient.y.mul(crossX)))

  return determinant.abs().mul(surfaceNormal).sub(surfaceGradient).normalize()
})`

const SCENE_DEPTH_FADE_SOURCE = `const MIN_FADE_DISTANCE = 0.0001

/**
 * 0 where the surface touches the scene behind it, 1 once the scene is 'distance' further away.
 *
 * View-space Z is negative in front of the camera, so geometry further away has a more negative
 * Z. 'fragmentZ - sceneZ' is therefore the (positive) gap between this fragment and the opaque
 * scene behind it, and it is 0 at the intersection.
 */
const sceneDepthFade = Fn(([distance]) => {
  const sceneViewZ = perspectiveDepthToViewZ(viewportDepthTexture(), cameraNear, cameraFar)
  const gap = positionView.z.sub(sceneViewZ)
  return clamp(gap.div(max(distance, MIN_FADE_DISTANCE)), 0, 1)
})`

export const TSL_HELPERS: Readonly<Record<HelperName, TslHelper>> = {
  simplexNoise3: {
    imports: ['Fn', 'abs', 'dot', 'floor', 'max', 'min', 'step', 'vec3', 'vec4'],
    source: SIMPLEX_NOISE_SOURCE,
  },
  normalFromHeight: {
    imports: ['Fn', 'dFdx', 'dFdy', 'faceDirection', 'normalView', 'positionView', 'vec2'],
    source: NORMAL_FROM_HEIGHT_SOURCE,
  },
  sceneDepthFade: {
    imports: [
      'Fn',
      'cameraFar',
      'cameraNear',
      'clamp',
      'max',
      'perspectiveDepthToViewZ',
      'positionView',
      'viewportDepthTexture',
    ],
    source: SCENE_DEPTH_FADE_SOURCE,
  },
}

/** Declaration order: a helper never reads another, so any stable order works. */
export const HELPER_ORDER: readonly HelperName[] = [
  'simplexNoise3',
  'normalFromHeight',
  'sceneDepthFade',
]
