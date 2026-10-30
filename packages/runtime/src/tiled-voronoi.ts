import {
  Fn,
  If,
  abs,
  dot,
  float,
  floor,
  max,
  mx_cell_noise_vec3,
  pow,
  select,
  vec2,
  vec4,
} from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * A 2D Voronoi that repeats: the cell search of three's MaterialX worley noise (same hash, jitter,
 * neighbor order and metric ids as `voronoiCell2`), with each neighbor's cell wrapped every
 * `period` cells before it is hashed into a feature point. The pattern at `point + period` equals
 * the pattern at `point`; a period of 0 leaves that axis unwrapped. Metric 4 is Blender's
 * Minkowski distance under `exponentInput`, measured as in `voronoiMinkowski2`. Returns vec4(F1,
 * F2, feature point of F1), the feature point unwrapped, in the space of `pointInput`.
 */

const TILED_MANHATTAN_METRIC = 2
const TILED_CHEBYSHEV_METRIC = 3
const TILED_MINKOWSKI_METRIC = 4
const TILED_MIN_EXPONENT = 0.01
const TILED_CELL_CENTER = 0.5
const TILED_FAR_DISTANCE = 1e6
const TILED_NEIGHBOR_OFFSETS = [-1, 0, 1]
const TILED_HALF = 0.5

const tiledCellDistance = (
  difference: Node<'vec2'>,
  metric: Node<'float'>,
  exponent: Node<'float'>,
): Node<'float'> =>
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

export const tiledVoronoi2 = Fn(
  ([pointInput, jitter, metric, exponentInput, periodInput]: [
    Node<'vec2'>,
    Node<'float'>,
    Node<'float'>,
    Node<'float'>,
    Node<'vec2'>,
  ]) => {
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
  },
)
