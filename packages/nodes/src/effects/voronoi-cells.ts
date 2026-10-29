import type {
  CellDimensions,
  ParamDefinition,
  ParamValue,
  TslFacade,
  VoronoiMetric,
} from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

/** What the 2D and 3D Voronoi nodes share: the distance param and how their outputs are built. */

const DEFAULT_DISTANCE: VoronoiMetric = 'euclidean'

const DISTANCE_OPTIONS: readonly EnumOption<VoronoiMetric>[] = [
  { value: 'euclidean', label: 'Euclidean' },
  { value: 'manhattan', label: 'Manhattan' },
  { value: 'chebyshev', label: 'Chebyshev' },
]

export const VORONOI_DISTANCE_PARAM: ParamDefinition = {
  id: 'distance',
  label: 'Distance',
  kind: 'enum',
  options: DISTANCE_OPTIONS,
  default: DEFAULT_DISTANCE,
}

export type VoronoiOutputId = 'f1' | 'f2' | 'edge' | 'cell' | 'random'

/**
 * F1, F2 and their difference, the feature point F1 measures and a random value per cell (the
 * cell noise of the floor of that point, which names its cell).
 */
export function buildVoronoiOutputs<E>(
  tsl: TslFacade<E>,
  dimensions: CellDimensions,
  point: E,
  jitter: E,
  params: Readonly<Record<string, ParamValue>>,
): Readonly<Record<VoronoiOutputId, E>> {
  const metric = resolveEnumParam(DISTANCE_OPTIONS, params.distance, DEFAULT_DISTANCE)
  const distances = tsl.voronoi(point, jitter, metric)
  const f1 = tsl.swizzle(distances, 'x')
  const f2 = tsl.swizzle(distances, 'y')
  const cell = tsl.voronoiCell(dimensions, point, jitter, metric)
  return { f1, f2, edge: tsl.sub(f2, f1), cell, random: tsl.cellNoise(tsl.floor(cell)) }
}
