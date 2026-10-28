/**
 * Layout of the "Grid" backdrop, ported from joyco's gltf viewer (lib/viz/systems/grid-system.ts):
 * thin grid lines plus "+" crosses at every other intersection, the center kept clear. One world
 * unit per cell suits our meshes, which are about two units across.
 */
export const GRID_SIZE = 100
export const GRID_DIVISIONS = 100
/** Wide enough to survive AA coverage at the idle viewing distance; quad lines thin with depth. */
export const GRID_LINE_WIDTH = 0.01
/** Crosses per side, two cells apart. */
export const CROSS_COUNT = 23
export const CROSS_LINE_WIDTH = 0.026
export const CROSS_HEIGHT = 0.5

const QUARTER_TURN = Math.PI / 2
const CROSS_SPACING = 2

/** A thin quad laid flat on the floor at (x, z), spun by `roll` within the floor plane. */
export interface FlatQuad {
  readonly x: number
  readonly z: number
  readonly roll: number
}

/** Two lines per division edge: one along X at z = offset, one along Z at x = offset. */
export function gridLineQuads(): readonly FlatQuad[] {
  const step = GRID_SIZE / GRID_DIVISIONS
  return Array.from(
    { length: GRID_DIVISIONS + 1 },
    (_, index) => -GRID_SIZE / 2 + index * step,
  ).flatMap((offset) => [
    { x: 0, z: offset, roll: 0 },
    { x: offset, z: 0, roll: QUARTER_TURN },
  ])
}

/** Two crossed bars per "+", at every other intersection, skipping the one under the mesh. */
export function crossQuads(): readonly FlatQuad[] {
  const center = Math.floor(CROSS_COUNT / 2)
  const quads: FlatQuad[] = []
  for (let row = 0; row < CROSS_COUNT; row += 1) {
    for (let column = 0; column < CROSS_COUNT; column += 1) {
      if (row === center && column === center) continue
      const x = (column - center) * CROSS_SPACING
      const z = (row - center) * CROSS_SPACING
      quads.push({ x, z, roll: 0 }, { x, z, roll: QUARTER_TURN })
    }
  }
  return quads
}
