import { concrete, float } from '@nudo-tsl/core'
import type {
  CellDimensions,
  InputDefinition,
  ParamDefinition,
  ParamValue,
  TslFacade,
  VoronoiMetric,
} from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

/** What the 2D and 3D Voronoi nodes share: the distance param and how their outputs are built. */

/** MaterialX's worley metrics, plus Blender's Minkowski, which runs its own cell search. */
type VoronoiDistance = VoronoiMetric | 'minkowski'

const DEFAULT_DISTANCE: VoronoiDistance = 'euclidean'

const DISTANCE_OPTIONS: readonly EnumOption<VoronoiDistance>[] = [
  { value: 'euclidean', label: 'Euclidean' },
  { value: 'manhattan', label: 'Manhattan' },
  { value: 'chebyshev', label: 'Chebyshev' },
  { value: 'minkowski', label: 'Minkowski' },
]

/** Blender's default: below 1, each cell pinches into a star, the painterly shaders' brush shape. */
const DEFAULT_MINKOWSKI_EXPONENT = 0.5

export const VORONOI_DISTANCE_PARAM: ParamDefinition = {
  id: 'distance',
  label: 'Distance',
  kind: 'enum',
  options: DISTANCE_OPTIONS,
  default: DEFAULT_DISTANCE,
}

const resolveDistance = (params: Readonly<Record<string, ParamValue>>): VoronoiDistance =>
  resolveEnumParam(DISTANCE_OPTIONS, params.distance, DEFAULT_DISTANCE)

/** The Minkowski exponent, in play only while the distance is Minkowski. */
export const VORONOI_EXPONENT_INPUT: InputDefinition<'exponent'> = {
  id: 'exponent',
  label: 'Exponent',
  type: concrete('float'),
  default: float(DEFAULT_MINKOWSKI_EXPONENT),
  description:
    'The shape of a Minkowski cell: 1 = diamond, 2 = round, higher = square, below 1 = a star.',
  hiddenWhen: (params) => resolveDistance(params) !== 'minkowski',
}

export type VoronoiOutputId = 'f1' | 'f2' | 'edge' | 'cell' | 'random'

interface CellSearch<E> {
  readonly distances: E
  readonly cell: E
}

function searchCells<E>(
  tsl: TslFacade<E>,
  dimensions: CellDimensions,
  point: E,
  jitter: E,
  exponent: E,
  distance: VoronoiDistance,
): CellSearch<E> {
  if (distance === 'minkowski') {
    return {
      distances: tsl.voronoiMinkowski(dimensions, point, jitter, exponent),
      cell: tsl.voronoiMinkowskiCell(dimensions, point, jitter, exponent),
    }
  }
  return {
    distances: tsl.voronoi(point, jitter, distance),
    cell: tsl.voronoiCell(dimensions, point, jitter, distance),
  }
}

/**
 * F1, F2 and their difference, the feature point F1 measures and a random value per cell (the
 * cell noise of the floor of that point, which names its cell). `exponent` is only read under the
 * Minkowski distance.
 */
export function buildVoronoiOutputs<E>(
  tsl: TslFacade<E>,
  dimensions: CellDimensions,
  point: E,
  jitter: E,
  exponent: E,
  params: Readonly<Record<string, ParamValue>>,
): Readonly<Record<VoronoiOutputId, E>> {
  const { distances, cell } = searchCells(
    tsl,
    dimensions,
    point,
    jitter,
    exponent,
    resolveDistance(params),
  )
  const f1 = tsl.swizzle(distances, 'x')
  const f2 = tsl.swizzle(distances, 'y')
  return { f1, f2, edge: tsl.sub(f2, f1), cell, random: tsl.cellNoise(tsl.floor(cell)) }
}
