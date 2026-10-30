import { graphDocumentV2 } from './seed-graph'

/**
 * The user's blob tutorial graph (about 20 nodes, five properties): Time-driven
 * noise deforms the surface, a remapped mask mixes two colors and the roughness, and a fresnel
 * adds a rim. Most of its previews are animated, which makes it the frame-budget reference.
 */

type Column = 0 | 1 | 2 | 3 | 4 | 5
const COLUMN_WIDTH = 300
const ROW_HEIGHT = 320
const at = (column: Column, row: number) => ({ x: column * COLUMN_WIDTH, y: row * ROW_HEIGHT })

const float = (value: number) => ({ type: 'float' as const, value })
const vec3 = (x: number, y: number, z: number) => ({ type: 'vec3' as const, value: [x, y, z] })

const reader = (id: string, propertyType: string, column: Column, row: number) => ({
  id,
  type: `property/${propertyType}`,
  position: at(column, row),
  params: { propertyId: id },
})

const NODES = [
  { id: 'pos', type: 'input/position', position: at(0, 0) },
  { id: 'time', type: 'input/time', position: at(0, 1) },
  reader('speed', 'float', 0, 2),
  { id: 'mul1', type: 'math/multiply', position: at(1, 1) },
  { id: 'add1', type: 'math/add', position: at(1, 0) },
  {
    id: 'noise',
    type: 'effects/noise',
    position: at(2, 0),
    inputValues: { scale: float(2.5) },
  },
  {
    id: 'remap',
    type: 'math/remap',
    position: at(3, 0),
    inputValues: { inMin: float(-1), inMax: float(1) },
  },
  { id: 'normal', type: 'input/normal', position: at(1, 3) },
  { id: 'mul2', type: 'math/multiply', position: at(2, 3) },
  reader('wobble', 'float', 2, 4),
  { id: 'mul3', type: 'math/multiply', position: at(3, 3) },
  { id: 'add2', type: 'math/add', position: at(4, 3) },
  reader('deep', 'vec3', 3, 5),
  reader('hot', 'vec3', 3, 6),
  {
    id: 'smooth',
    type: 'interpolation/smoothstep',
    position: at(4, 0),
    inputValues: { edge0: float(0.35), edge1: float(0.65) },
  },
  { id: 'lerp1', type: 'interpolation/lerp', position: at(4, 5) },
  {
    id: 'fresnel',
    type: 'effects/fresnel',
    position: at(3, 7),
    inputValues: { power: float(3) },
  },
  reader('rim', 'vec3', 3, 8),
  { id: 'mul4', type: 'math/multiply', position: at(4, 7) },
  {
    id: 'lerp2',
    type: 'interpolation/lerp',
    position: at(4, 1),
    inputValues: { a: float(0.15), b: float(0.6) },
  },
]

const WIRES: readonly (readonly [string, string, string, string])[] = [
  ['time', 'out', 'mul1', 'a'],
  ['speed', 'out', 'mul1', 'b'],
  ['pos', 'out', 'add1', 'a'],
  ['mul1', 'out', 'add1', 'b'],
  ['add1', 'out', 'noise', 'p'],
  ['noise', 'out', 'remap', 'in'],
  ['normal', 'out', 'mul2', 'a'],
  ['noise', 'out', 'mul2', 'b'],
  ['mul2', 'out', 'mul3', 'a'],
  ['wobble', 'out', 'mul3', 'b'],
  ['pos', 'out', 'add2', 'a'],
  ['mul3', 'out', 'add2', 'b'],
  ['add2', 'out', 'master', 'position'],
  ['deep', 'out', 'lerp1', 'a'],
  ['hot', 'out', 'lerp1', 'b'],
  ['remap', 'out', 'smooth', 'in'],
  ['smooth', 'out', 'lerp1', 't'],
  ['lerp1', 'out', 'master', 'baseColor'],
  ['fresnel', 'out', 'mul4', 'a'],
  ['rim', 'out', 'mul4', 'b'],
  ['mul4', 'out', 'master', 'emission'],
  ['remap', 'out', 'lerp2', 't'],
  ['lerp2', 'out', 'master', 'roughness'],
]

const property = (
  id: string,
  label: string,
  value: ReturnType<typeof float> | ReturnType<typeof vec3>,
) => ({ id, label, name: id, exposed: true, type: value.type, value })

export const BLOB_TUTORIAL_GRAPH = graphDocumentV2(
  NODES,
  WIRES.map(([fromNode, fromPort, toNode, toPort]) => ({
    id: `${fromNode}-${toNode}-${toPort}`,
    from: [fromNode, fromPort],
    to: [toNode, toPort],
  })),
  [
    property('speed', 'speed', float(0.3)),
    property('wobble', 'wobble', float(0.12)),
    property('deep', 'deepColor', vec3(0.1, 0.05, 0.4)),
    property('hot', 'hotColor', vec3(1, 0.4, 0.2)),
    property('rim', 'rimColor', vec3(0.3, 0.9, 1)),
  ],
)
