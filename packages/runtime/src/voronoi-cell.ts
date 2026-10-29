import {
  Fn,
  If,
  abs,
  dot,
  float,
  floor,
  max,
  mx_cell_noise_vec3,
  select,
  vec2,
  vec3,
} from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * The feature point a Voronoi's F1 measures: the cell search of three's MaterialX worley noise
 * (`mx_worley_noise_vec2` / `_vec3`), with the same hash, jitter, neighbor order and metric ids,
 * so the point always belongs to the cell the F1 pattern draws. It is returned in the space of
 * `pointInput`, which is what the cell noise of its floor needs to give each cell its own value.
 */

/** MaterialX's metric ids (`mx_worley_distance`); any other id compares squared distances. */
const MANHATTAN_METRIC = 2
const CHEBYSHEV_METRIC = 3
/** Each feature point sits within its unit cell around the center, pushed out by the jitter. */
const CELL_CENTER = 0.5
/** Further than any neighbor can be, so the first one searched always becomes the nearest. */
const FAR_DISTANCE = 1e6
/** The searched cells: the point's own and every neighbor, in MaterialX's order. */
const NEIGHBOR_OFFSETS = [-1, 0, 1]

const cellDistance2 = (difference: Node<'vec2'>, metric: Node<'float'>): Node<'float'> =>
  select(
    metric.equal(MANHATTAN_METRIC),
    abs(difference.x).add(abs(difference.y)),
    select(
      metric.equal(CHEBYSHEV_METRIC),
      max(abs(difference.x), abs(difference.y)),
      dot(difference, difference),
    ),
  )

const cellDistance3 = (difference: Node<'vec3'>, metric: Node<'float'>): Node<'float'> =>
  select(
    metric.equal(MANHATTAN_METRIC),
    abs(difference.x).add(abs(difference.y)).add(abs(difference.z)),
    select(
      metric.equal(CHEBYSHEV_METRIC),
      max(abs(difference.x), abs(difference.y), abs(difference.z)),
      dot(difference, difference),
    ),
  )

export const voronoiCell2 = Fn(
  ([pointInput, jitter, metric]: [Node<'vec2'>, Node<'float'>, Node<'float'>]) => {
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
  },
)

export const voronoiCell3 = Fn(
  ([pointInput, jitter, metric]: [Node<'vec3'>, Node<'float'>, Node<'float'>]) => {
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
  },
)
