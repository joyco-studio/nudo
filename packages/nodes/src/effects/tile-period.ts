import { concrete, vec2, vec3 } from '@nudo-tsl/core'
import type { InputDefinition, ParamDefinition, ParamValue, TslFacade } from '@nudo-tsl/core'

/**
 * What the tileable Noise and Voronoi share: a Tile switch, the Period input it shows, and how a
 * period in input units becomes a whole number of lattice cells.
 */

export const TILE_PARAM_ID = 'tile'

export const TILE_PARAM: ParamDefinition = {
  id: TILE_PARAM_ID,
  label: 'Tile',
  kind: 'boolean',
  default: false,
  description:
    'Repeats the pattern seamlessly every Period, for UVs that wrap around a mesh or a texture that tiles.',
}

/** Whether the node tiles: the Period input only counts, and only shows, while it does. */
export const isTiling = (params: Readonly<Record<string, ParamValue>>): boolean =>
  params[TILE_PARAM_ID] === true

const PERIOD_DESCRIPTION =
  'How far apart the repeats are, in the units of the input, per axis; 0 leaves an axis endless.'

/** The Period input of a 2D pattern: one UV square by default. */
export const PERIOD_2D: InputDefinition<'period'> = {
  id: 'period',
  label: 'Period',
  type: concrete('vec2'),
  default: vec2(1, 1),
  description: PERIOD_DESCRIPTION,
  hiddenWhen: (params) => !isTiling(params),
}

/** The Period input of a 3D pattern: one UV square across X and Y, endless along Z. */
export const PERIOD_3D: InputDefinition<'period'> = {
  id: 'period',
  label: 'Period',
  type: concrete('vec3'),
  default: vec3(1, 1, 0),
  description: PERIOD_DESCRIPTION,
  hiddenWhen: (params) => !isTiling(params),
}

/** Below this a period counts as 0: the axis does not repeat. */
const NO_PERIOD = 0.0001
const HALF = 0.5

export interface LatticeTiling<E> {
  /** The repeat in lattice cells: whole, at least 1 where the axis tiles, 0 where it doesn't. */
  readonly lattice: E
  /**
   * What the scaled coordinate is multiplied by so the repeat lands on whole cells: 1 on an axis
   * that doesn't tile, and close to 1 elsewhere.
   */
  readonly fit: E
}

/**
 * The lattice repeat of a period that spans `cells` lattice cells (period × scale × frequency).
 * The cells are rounded to whole numbers, and the coordinate is stretched a hair so the pattern
 * repeats exactly every period whatever the scale.
 */
export function latticeTiling<E>(tsl: TslFacade<E>, cells: E): LatticeTiling<E> {
  const one = tsl.construct('float', [1])
  const tiles = tsl.step(tsl.construct('float', [NO_PERIOD]), cells)
  const rounded = tsl.floor(tsl.add(cells, tsl.construct('float', [HALF])))
  const lattice = tsl.max(rounded, tiles)
  const stretch = tsl.div(lattice, tsl.max(cells, tsl.construct('float', [NO_PERIOD])))
  return { lattice, fit: tsl.mix(one, stretch, tiles) }
}

/**
 * A whole-numbered lattice cell wrapped into the first repeat: `cell` modulo `lattice`, unchanged
 * where 0. Nudged by half so a rounded division never drops a cell below its tile.
 */
export function wrapCell<E>(tsl: TslFacade<E>, cell: E, lattice: E): E {
  const one = tsl.construct('float', [1])
  const nudged = tsl.add(cell, tsl.construct('float', [HALF]))
  return tsl.sub(cell, tsl.mul(lattice, tsl.floor(tsl.div(nudged, tsl.max(lattice, one)))))
}
