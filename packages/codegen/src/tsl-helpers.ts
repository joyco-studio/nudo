import type { HelperName } from './code-expression'

/** A local `Fn` a generated module declares, with the `three/tsl` names its body uses. */
export interface TslHelper {
  readonly imports: readonly string[]
  readonly source: string
}

/**
 * These sources mirror the live runtime's helpers (`packages/runtime/src/simplex-noise.ts`,
 * `normal-from-height.ts`, `scene-depth-fade.ts`, `voronoi-cell.ts`, `voronoi-minkowski.ts` and
 * `hash-noise.ts`) minus
 * their type annotations. A parity test compares them with the runtime files, so a change on one
 * side must be made on the other.
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

/** Declares both 'voronoiCell2' and 'voronoiCell3', which share their metric and search constants. */
const VORONOI_CELL_SOURCE = `/**
 * The feature point a Voronoi's F1 measures: the cell search of three's MaterialX worley noise
 * ('mx_worley_noise_vec2' / '_vec3'), with the same hash, jitter, neighbor order and metric ids,
 * so the point always belongs to the cell the F1 pattern draws. It is returned in the space of
 * 'pointInput', which is what the cell noise of its floor needs to give each cell its own value.
 */

/** MaterialX's metric ids ('mx_worley_distance'); any other id compares squared distances. */
const MANHATTAN_METRIC = 2
const CHEBYSHEV_METRIC = 3
/** Each feature point sits within its unit cell around the center, pushed out by the jitter. */
const CELL_CENTER = 0.5
/** Further than any neighbor can be, so the first one searched always becomes the nearest. */
const FAR_DISTANCE = 1e6
/** The searched cells: the point's own and every neighbor, in MaterialX's order. */
const NEIGHBOR_OFFSETS = [-1, 0, 1]

const cellDistance2 = (difference, metric) =>
  select(
    metric.equal(MANHATTAN_METRIC),
    abs(difference.x).add(abs(difference.y)),
    select(
      metric.equal(CHEBYSHEV_METRIC),
      max(abs(difference.x), abs(difference.y)),
      dot(difference, difference),
    ),
  )

const cellDistance3 = (difference, metric) =>
  select(
    metric.equal(MANHATTAN_METRIC),
    abs(difference.x).add(abs(difference.y)).add(abs(difference.z)),
    select(
      metric.equal(CHEBYSHEV_METRIC),
      max(abs(difference.x), abs(difference.y), abs(difference.z)),
      dot(difference, difference),
    ),
  )

const voronoiCell2 = Fn(([pointInput, jitter, metric]) => {
  const point = vec2(pointInput).toVar()
  const baseCell = floor(point).toVar()
  const localPosition = point.sub(baseCell).toVar()
  const nearestDistance = float(FAR_DISTANCE).toVar()
  const nearestPoint = vec2(baseCell).toVar()

  for (const x of NEIGHBOR_OFFSETS) {
    for (const y of NEIGHBOR_OFFSETS) {
      const neighbor = vec2(x, y)
      const featureOffset = mx_cell_noise_vec3(baseCell.add(neighbor))
        .xy.sub(CELL_CENTER)
        .mul(jitter)
        .add(CELL_CENTER)
      const featurePoint = neighbor.add(featureOffset).toVar()
      const featureDistance = cellDistance2(featurePoint.sub(localPosition), metric).toVar()

      If(featureDistance.lessThan(nearestDistance), () => {
        nearestDistance.assign(featureDistance)
        nearestPoint.assign(baseCell.add(featurePoint))
      })
    }
  }

  return nearestPoint
})

const voronoiCell3 = Fn(([pointInput, jitter, metric]) => {
  const point = vec3(pointInput).toVar()
  const baseCell = floor(point).toVar()
  const localPosition = point.sub(baseCell).toVar()
  const nearestDistance = float(FAR_DISTANCE).toVar()
  const nearestPoint = vec3(baseCell).toVar()

  for (const x of NEIGHBOR_OFFSETS) {
    for (const y of NEIGHBOR_OFFSETS) {
      for (const z of NEIGHBOR_OFFSETS) {
        const neighbor = vec3(x, y, z)
        const featureOffset = mx_cell_noise_vec3(baseCell.add(neighbor))
          .sub(CELL_CENTER)
          .mul(jitter)
          .add(CELL_CENTER)
        const featurePoint = neighbor.add(featureOffset).toVar()
        const featureDistance = cellDistance3(featurePoint.sub(localPosition), metric).toVar()

        If(featureDistance.lessThan(nearestDistance), () => {
          nearestDistance.assign(featureDistance)
          nearestPoint.assign(baseCell.add(featurePoint))
        })
      }
    }
  }

  return nearestPoint
})`

/** One source declares both cell searches; a module that uses both prints it once. */
const VORONOI_CELL: TslHelper = {
  imports: [
    'Fn',
    'If',
    'abs',
    'dot',
    'float',
    'floor',
    'max',
    'mx_cell_noise_vec3',
    'select',
    'vec2',
    'vec3',
  ],
  source: VORONOI_CELL_SOURCE,
}

/** Declares the Minkowski distance and cell searches, which share one search per dimension. */
const VORONOI_MINKOWSKI_SOURCE = `/**
 * Voronoi under the Minkowski distance, (|dx|^e + |dy|^e + |dz|^e)^(1/e), as Blender measures it:
 * an exponent of 1 is Manhattan, 2 is Euclidean, a large one nears Chebyshev, and one below 1
 * pinches each cell into a star. MaterialX's worley noise has no such metric, so this runs its own
 * cell search, with the hash, jitter and neighbor order of 'voronoi-cell.ts', so the cells sit
 * where the other metrics put them. Its constants carry their own names because a generated module
 * may declare both searches side by side.
 */

/** Each feature point sits within its unit cell around the center, pushed out by the jitter. */
const MINKOWSKI_CELL_CENTER = 0.5
/** Further than any neighbor can be, so the first ones searched always become F1 and F2. */
const MINKOWSKI_FAR_DISTANCE = 1e6
/** The searched cells: the point's own and every neighbor, in MaterialX's order. */
const MINKOWSKI_NEIGHBOR_OFFSETS = [-1, 0, 1]
/** Keeps 1 / exponent finite: an exponent of 0 would divide by zero. */
const MIN_MINKOWSKI_EXPONENT = 0.01

const minkowskiDistance2 = (difference, exponent) =>
  pow(
    pow(abs(difference.x), exponent).add(pow(abs(difference.y), exponent)),
    float(1).div(exponent),
  )

const minkowskiDistance3 = (difference, exponent) =>
  pow(
    pow(abs(difference.x), exponent)
      .add(pow(abs(difference.y), exponent))
      .add(pow(abs(difference.z), exponent)),
    float(1).div(exponent),
  )

/** Keeps F1 and F2 up to date with one more feature distance; 'onNearer' runs when it is the new F1. */
const keepNearest = (featureDistance, nearestDistance, secondDistance, onNearer) => {
  If(featureDistance.lessThan(nearestDistance), () => {
    secondDistance.assign(nearestDistance)
    nearestDistance.assign(featureDistance)
    onNearer()
  }).ElseIf(featureDistance.lessThan(secondDistance), () => {
    secondDistance.assign(featureDistance)
  })
}

const searchMinkowski2 = (pointInput, jitter, exponentInput) => {
  const point = vec2(pointInput).toVar()
  const exponent = max(exponentInput, MIN_MINKOWSKI_EXPONENT).toVar()
  const baseCell = floor(point).toVar()
  const localPosition = point.sub(baseCell).toVar()
  const nearestDistance = float(MINKOWSKI_FAR_DISTANCE).toVar()
  const secondDistance = float(MINKOWSKI_FAR_DISTANCE).toVar()
  const nearestPoint = vec2(baseCell).toVar()

  for (const x of MINKOWSKI_NEIGHBOR_OFFSETS) {
    for (const y of MINKOWSKI_NEIGHBOR_OFFSETS) {
      const neighbor = vec2(x, y)
      const featureOffset = mx_cell_noise_vec3(baseCell.add(neighbor))
        .xy.sub(MINKOWSKI_CELL_CENTER)
        .mul(jitter)
        .add(MINKOWSKI_CELL_CENTER)
      const featurePoint = neighbor.add(featureOffset).toVar()
      const featureDistance = minkowskiDistance2(featurePoint.sub(localPosition), exponent).toVar()

      keepNearest(featureDistance, nearestDistance, secondDistance, () => {
        nearestPoint.assign(baseCell.add(featurePoint))
      })
    }
  }

  return { distances: vec2(nearestDistance, secondDistance), nearestPoint }
}

const searchMinkowski3 = (pointInput, jitter, exponentInput) => {
  const point = vec3(pointInput).toVar()
  const exponent = max(exponentInput, MIN_MINKOWSKI_EXPONENT).toVar()
  const baseCell = floor(point).toVar()
  const localPosition = point.sub(baseCell).toVar()
  const nearestDistance = float(MINKOWSKI_FAR_DISTANCE).toVar()
  const secondDistance = float(MINKOWSKI_FAR_DISTANCE).toVar()
  const nearestPoint = vec3(baseCell).toVar()

  for (const x of MINKOWSKI_NEIGHBOR_OFFSETS) {
    for (const y of MINKOWSKI_NEIGHBOR_OFFSETS) {
      for (const z of MINKOWSKI_NEIGHBOR_OFFSETS) {
        const neighbor = vec3(x, y, z)
        const featureOffset = mx_cell_noise_vec3(baseCell.add(neighbor))
          .sub(MINKOWSKI_CELL_CENTER)
          .mul(jitter)
          .add(MINKOWSKI_CELL_CENTER)
        const featurePoint = neighbor.add(featureOffset).toVar()
        const featureDistance = minkowskiDistance3(
          featurePoint.sub(localPosition),
          exponent,
        ).toVar()

        keepNearest(featureDistance, nearestDistance, secondDistance, () => {
          nearestPoint.assign(baseCell.add(featurePoint))
        })
      }
    }
  }

  return { distances: vec2(nearestDistance, secondDistance), nearestPoint }
}

const voronoiMinkowski2 = Fn(([pointInput, jitter, exponent]) =>
  searchMinkowski2(pointInput, jitter, exponent).distances,
)

const voronoiMinkowskiCell2 = Fn(([pointInput, jitter, exponent]) =>
  searchMinkowski2(pointInput, jitter, exponent).nearestPoint,
)

const voronoiMinkowski3 = Fn(([pointInput, jitter, exponent]) =>
  searchMinkowski3(pointInput, jitter, exponent).distances,
)

const voronoiMinkowskiCell3 = Fn(([pointInput, jitter, exponent]) =>
  searchMinkowski3(pointInput, jitter, exponent).nearestPoint,
)`

/** One source declares all four Minkowski searches; a module that uses several prints it once. */
const VORONOI_MINKOWSKI: TslHelper = {
  imports: [
    'Fn',
    'If',
    'abs',
    'float',
    'floor',
    'max',
    'mx_cell_noise_vec3',
    'pow',
    'vec2',
    'vec3',
  ],
  source: VORONOI_MINKOWSKI_SOURCE,
}

const HASH_SOURCE = `/**
 * White noise from a point, after Dave Hoskins' "hash without sine" (MIT,
 * shadertoy.com/view/4djSRW, 'hash13' and 'hash33'). It only uses fract, multiply and add, so every GPU and both backends give
 * the same values, and it needs no integer math. Three's own 'hash' is no substitute: it truncates
 * its input to an integer, which collapses a continuous point such as UV into a few values.
 * Returns floats in [0, 1).
 *
 * Everything runs in float32, so a hash has only about 10 bits of distinct values over a UV: plenty
 * for grain, colors and scattering, but coarse for a hard threshold near 0 or 1.
 */

/** Multiplied into the point first, so a float (repeated into all three axes) is not symmetric. */
const AXIS_SKEW = [1, 1.6180339887, 2.7182818285]
/** Per-axis scale of the point before its fraction is taken. */
const HASH_SCALE = [0.1031, 0.103, 0.0973]
/** Moves each seed to its own offset: the plastic constant's powers spread seeds evenly. */
const SEED_STRIDE = [0.7548776662, 0.569840291, 0.430159709]
const MIX_OFFSET = 33.33
/**
 * Each output scrambles the point with its own seed offset, so its value does not depend on the
 * others. A shared scramble feeding all of them left the three Out3 channels correlated near the
 * origin (UV, seed 0), where the fresh node sits.
 */
const OUT_SHIFT = 0
const RED_SHIFT = 0.25
const GREEN_SHIFT = 0.5
const BLUE_SHIFT = 0.75

/** Adds the mix of all three axes to each axis. */
const mixAxes = (value) => value.add(dot(value, value.yxz.add(MIX_OFFSET)))

/**
 * Two rounds of scale, fraction and mix. One round leaves a point that moves a little (a pixel of
 * UV) with a nearly unchanged value; the second makes neighbors unrelated.
 */
const scrambledPoint = (pointInput, seed, shift) => {
  const point = vec3(pointInput).mul(vec3(...AXIS_SKEW))
  const seedOffset = fract(seed.mul(vec3(...SEED_STRIDE)).add(shift))
  const firstRound = mixAxes(fract(point.mul(vec3(...HASH_SCALE)).add(seedOffset))).toVar()
  return mixAxes(fract(firstRound.mul(vec3(...HASH_SCALE))))
}

const hashChannel = (pointInput, seed, shift) => {
  const scrambled = scrambledPoint(pointInput, seed, shift).toVar()
  return fract(scrambled.y.add(scrambled.z).mul(scrambled.x))
}

const hashFloat = Fn(([pointInput, seed]) =>
  hashChannel(pointInput, seed, OUT_SHIFT),
)

const hashVec3 = Fn(([pointInput, seed]) =>
  vec3(
    hashChannel(pointInput, seed, RED_SHIFT),
    hashChannel(pointInput, seed, GREEN_SHIFT),
    hashChannel(pointInput, seed, BLUE_SHIFT),
  ),
)`

/** One source declares both hashes; a module that uses both prints it once. */
const HASH: TslHelper = { imports: ['Fn', 'dot', 'fract', 'vec3'], source: HASH_SOURCE }

const TILED_NOISE_SOURCE = `/**
 * 3D gradient (Perlin) noise that repeats. The lattice cell of each corner is wrapped every
 * 'period' cells per axis before it is hashed into a gradient, so the noise at 'point + period'
 * equals the noise at 'point'; a period of 0 leaves that axis unwrapped. Periods are whole numbers.
 * The corner hash is Dave Hoskins' hash33 ("Hash without Sine", MIT), float-only so every GPU
 * agrees. Returns a float in roughly [-1, 1].
 */
const TILED_HASH_SCALE_X = 0.1031
const TILED_HASH_SCALE_Y = 0.103
const TILED_HASH_SCALE_Z = 0.0973
const TILED_HASH_OFFSET = 33.33
/** Brings the gradient noise to the spread of the simplex noise, about ±1 at most. */
const TILED_OUTPUT_SCALE = 1.4
const TILED_HALF = 0.5
/**
 * 'cell' modulo 'period' per axis, into [0, period); a 0 period leaves the axis as it is. The cell
 * is a whole number: nudging it by half keeps the division off a whole-number boundary, where a
 * GPU's rounded reciprocal could land just below it and break the repeat.
 */
const tiledWrapCell = (cell, period) =>
  cell.sub(period.mul(floor(cell.add(TILED_HALF).div(max(period, 1)))))
/** A pseudo-random gradient in [-1, 1]³ for a whole-numbered lattice cell. */
const tiledCornerGradient = (cell) => {
  const scrambled = fract(
    cell.mul(vec3(TILED_HASH_SCALE_X, TILED_HASH_SCALE_Y, TILED_HASH_SCALE_Z)),
  ).toVar()
  const mixed = scrambled.add(dot(scrambled, scrambled.yxz.add(TILED_HASH_OFFSET))).toVar()
  return fract(mixed.xxy.add(mixed.yxx).mul(mixed.zyx)).mul(2).sub(1)
}
const tiledNoise3 = Fn(([pointInput, periodInput]) => {
  const point = vec3(pointInput).toVar()
  const period = vec3(periodInput).toVar()
  const base = floor(point).toVar()
  const local = point.sub(base).toVar()
  // Quintic fade: 6t⁵ − 15t⁴ + 10t³.
  const fade = local
    .mul(local)
    .mul(local)
    .mul(local.mul(local.mul(6).sub(15)).add(10))
    .toVar()
  const corner = (x, y, z) => {
    const offset = vec3(x, y, z)
    return dot(tiledCornerGradient(tiledWrapCell(base.add(offset), period)), local.sub(offset))
  }
  const bottomFront = mix(corner(0, 0, 0), corner(1, 0, 0), fade.x)
  const topFront = mix(corner(0, 1, 0), corner(1, 1, 0), fade.x)
  const bottomBack = mix(corner(0, 0, 1), corner(1, 0, 1), fade.x)
  const topBack = mix(corner(0, 1, 1), corner(1, 1, 1), fade.x)
  return mix(mix(bottomFront, topFront, fade.y), mix(bottomBack, topBack, fade.y), fade.z).mul(
    TILED_OUTPUT_SCALE,
  )
})`

const TILED_VORONOI_SOURCE = `/**
 * A 2D Voronoi that repeats: the cell search of three's MaterialX worley noise (same hash, jitter,
 * neighbor order and metric ids as 'voronoiCell2'), with each neighbor's cell wrapped every
 * 'period' cells before it is hashed into a feature point. The pattern at 'point + period' equals
 * the pattern at 'point'; a period of 0 leaves that axis unwrapped. Metric 4 is Blender's
 * Minkowski distance under 'exponentInput', measured as in 'voronoiMinkowski2'. Returns vec4(F1,
 * F2, feature point of F1), the feature point unwrapped, in the space of 'pointInput'.
 */
const TILED_MANHATTAN_METRIC = 2
const TILED_CHEBYSHEV_METRIC = 3
const TILED_MINKOWSKI_METRIC = 4
const TILED_MIN_EXPONENT = 0.01
const TILED_CELL_CENTER = 0.5
const TILED_FAR_DISTANCE = 1e6
const TILED_NEIGHBOR_OFFSETS = [-1, 0, 1]
const TILED_HALF = 0.5
const tiledCellDistance = (difference, metric, exponent) =>
  select(
    metric.equal(TILED_MINKOWSKI_METRIC),
    pow(
      pow(abs(difference.x), exponent).add(pow(abs(difference.y), exponent)),
      float(1).div(exponent),
    ),
    select(
      metric.equal(TILED_MANHATTAN_METRIC),
      abs(difference.x).add(abs(difference.y)),
      select(
        metric.equal(TILED_CHEBYSHEV_METRIC),
        max(abs(difference.x), abs(difference.y)),
        dot(difference, difference),
      ),
    ),
  )
const tiledVoronoi2 = Fn(([pointInput, jitter, metric, exponentInput, periodInput]) => {
  const point = vec2(pointInput).toVar()
  const exponent = max(exponentInput, TILED_MIN_EXPONENT).toVar()
  const period = vec2(periodInput).toVar()
  const baseCell = floor(point).toVar()
  const localPosition = point.sub(baseCell).toVar()
  const nearestDistance = float(TILED_FAR_DISTANCE).toVar()
  const secondDistance = float(TILED_FAR_DISTANCE).toVar()
  const nearestPoint = vec2(baseCell).toVar()
  for (const x of TILED_NEIGHBOR_OFFSETS) {
    for (const y of TILED_NEIGHBOR_OFFSETS) {
      const neighbor = vec2(x, y)
      const cell = baseCell.add(neighbor)
      // Nudged by half, so a GPU's rounded division never drops a whole cell below its tile.
      const wrapped = cell.sub(period.mul(floor(cell.add(TILED_HALF).div(max(period, 1)))))
      const featureOffset = mx_cell_noise_vec3(wrapped)
        .xy.sub(TILED_CELL_CENTER)
        .mul(jitter)
        .add(TILED_CELL_CENTER)
      const featurePoint = neighbor.add(featureOffset).toVar()
      const featureDistance = tiledCellDistance(
        featurePoint.sub(localPosition),
        metric,
        exponent,
      ).toVar()
      If(featureDistance.lessThan(nearestDistance), () => {
        secondDistance.assign(nearestDistance)
        nearestDistance.assign(featureDistance)
        nearestPoint.assign(baseCell.add(featurePoint))
      }).ElseIf(featureDistance.lessThan(secondDistance), () => {
        secondDistance.assign(featureDistance)
      })
    }
  }
  return vec4(nearestDistance, secondDistance, nearestPoint)
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
  voronoiCell2: VORONOI_CELL,
  voronoiCell3: VORONOI_CELL,
  voronoiMinkowski2: VORONOI_MINKOWSKI,
  voronoiMinkowski3: VORONOI_MINKOWSKI,
  voronoiMinkowskiCell2: VORONOI_MINKOWSKI,
  voronoiMinkowskiCell3: VORONOI_MINKOWSKI,
  hashFloat: HASH,
  hashVec3: HASH,
  tiledNoise3: {
    imports: ['Fn', 'dot', 'floor', 'fract', 'max', 'mix', 'vec3'],
    source: TILED_NOISE_SOURCE,
  },
  tiledVoronoi2: {
    imports: [
      'Fn',
      'If',
      'abs',
      'dot',
      'float',
      'floor',
      'max',
      'mx_cell_noise_vec3',
      'pow',
      'select',
      'vec2',
      'vec4',
    ],
    source: TILED_VORONOI_SOURCE,
  },
}

/** Declaration order: a helper never reads another, so any stable order works. */
export const HELPER_ORDER: readonly HelperName[] = [
  'simplexNoise3',
  'normalFromHeight',
  'sceneDepthFade',
  'voronoiCell2',
  'voronoiCell3',
  'voronoiMinkowski2',
  'voronoiMinkowski3',
  'voronoiMinkowskiCell2',
  'voronoiMinkowskiCell3',
  'hashFloat',
  'hashVec3',
  'tiledNoise3',
  'tiledVoronoi2',
]
