import { Fn, If, abs, float, floor, max, mx_cell_noise_vec3, pow, vec2, vec3 } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * Voronoi under the Minkowski distance, (|dx|^e + |dy|^e + |dz|^e)^(1/e), as Blender measures it:
 * an exponent of 1 is Manhattan, 2 is Euclidean, a large one nears Chebyshev, and one below 1
 * pinches each cell into a star. MaterialX's worley noise has no such metric, so this runs its own
 * cell search, with the hash, jitter and neighbor order of `voronoi-cell.ts`, so the cells sit
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

const minkowskiDistance2 = (difference: Node<'vec2'>, exponent: Node<'float'>): Node<'float'> =>
  pow(
    pow(abs(difference.x), exponent).add(pow(abs(difference.y), exponent)),
    float(1).div(exponent),
  )

const minkowskiDistance3 = (difference: Node<'vec3'>, exponent: Node<'float'>): Node<'float'> =>
  pow(
    pow(abs(difference.x), exponent)
      .add(pow(abs(difference.y), exponent))
      .add(pow(abs(difference.z), exponent)),
    float(1).div(exponent),
  )

/** Keeps F1 and F2 up to date with one more feature distance; `onNearer` runs when it is the new F1. */
const keepNearest = (
  featureDistance: Node<'float'>,
  nearestDistance: Node<'float'>,
  secondDistance: Node<'float'>,
  onNearer: () => void,
): void => {
  If(featureDistance.lessThan(nearestDistance), () => {
    secondDistance.assign(nearestDistance)
    nearestDistance.assign(featureDistance)
    onNearer()
  }).ElseIf(featureDistance.lessThan(secondDistance), () => {
    secondDistance.assign(featureDistance)
  })
}

const searchMinkowski2 = (
  pointInput: Node<'vec2'>,
  jitter: Node<'float'>,
  exponentInput: Node<'float'>,
): { readonly distances: Node<'vec2'>; readonly nearestPoint: Node<'vec2'> } => {
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

const searchMinkowski3 = (
  pointInput: Node<'vec3'>,
  jitter: Node<'float'>,
  exponentInput: Node<'float'>,
): { readonly distances: Node<'vec2'>; readonly nearestPoint: Node<'vec3'> } => {
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

export const voronoiMinkowski2 = Fn(
  ([pointInput, jitter, exponent]: [Node<'vec2'>, Node<'float'>, Node<'float'>]) =>
    searchMinkowski2(pointInput, jitter, exponent).distances,
)

export const voronoiMinkowskiCell2 = Fn(
  ([pointInput, jitter, exponent]: [Node<'vec2'>, Node<'float'>, Node<'float'>]) =>
    searchMinkowski2(pointInput, jitter, exponent).nearestPoint,
)

export const voronoiMinkowski3 = Fn(
  ([pointInput, jitter, exponent]: [Node<'vec3'>, Node<'float'>, Node<'float'>]) =>
    searchMinkowski3(pointInput, jitter, exponent).distances,
)

export const voronoiMinkowskiCell3 = Fn(
  ([pointInput, jitter, exponent]: [Node<'vec3'>, Node<'float'>, Node<'float'>]) =>
    searchMinkowski3(pointInput, jitter, exponent).nearestPoint,
)
