import { graphDocumentV2 } from './seed-graph'
import type { SeedEdge, SeedNode, SeedProperty } from './seed-graph'

/**
 * The "iridescent blob" tutorial graph (.context/blob-tutorial-graph.html): 22 nodes and 23
 * connections into the Master Stack, at the positions the tutorial left them, wires crossing.
 */

const floatProperty = (name: string, value: number): SeedProperty => ({
  id: name,
  label: name,
  name,
  exposed: true,
  type: 'float',
  value: { type: 'float', value },
})

const colorProperty = (name: string, value: readonly number[]): SeedProperty => ({
  id: name,
  label: name,
  name,
  exposed: true,
  type: 'vec3',
  value: { type: 'vec3', value },
})

const PROPERTIES: readonly SeedProperty[] = [
  floatProperty('speed', 0.3),
  floatProperty('wobble', 0.12),
  colorProperty('deepColor', [0.106, 0.122, 0.42]),
  colorProperty('hotColor', [1, 0.31, 0.639]),
  colorProperty('rimColor', [0.486, 0.969, 1]),
]

const at = (x: number, y: number) => ({ x, y })
const reader = (id: string, type: string, property: string, x: number, y: number): SeedNode => ({
  id,
  type,
  position: at(x, y),
  params: { propertyId: property },
})
const float = (value: number) => ({ type: 'float' as const, value })

const NODES: readonly SeedNode[] = [
  { id: 'pos', type: 'input/position', position: at(40, 120) },
  { id: 'time', type: 'input/time', position: at(40, 262) },
  reader('speed', 'property/float', 'speed', 40, 370),
  { id: 'mul1', type: 'math/multiply', position: at(290, 262) },
  { id: 'add1', type: 'math/add', position: at(530, 150) },
  {
    id: 'noise',
    type: 'effects/noise',
    position: at(770, 150),
    inputValues: { scale: float(2.5) },
  },
  {
    id: 'remap',
    type: 'math/remap',
    position: at(1020, 110),
    inputValues: { inMin: float(-1) },
  },
  { id: 'normal', type: 'input/normal', position: at(770, 560) },
  { id: 'mul2', type: 'math/multiply', position: at(1020, 520) },
  reader('wobble', 'property/float', 'wobble', 1020, 680),
  { id: 'mul3', type: 'math/multiply', position: at(1270, 560) },
  { id: 'add2', type: 'math/add', position: at(1500, 470) },
  reader('deep', 'property/vec3', 'deepColor', 1020, 860),
  reader('hot', 'property/vec3', 'hotColor', 1020, 920),
  {
    id: 'smooth',
    type: 'interpolation/smoothstep',
    position: at(1020, 990),
    inputValues: { edge0: float(0.35), edge1: float(0.65) },
  },
  { id: 'lerp1', type: 'interpolation/lerp', position: at(1270, 870) },
  {
    id: 'fresnel',
    type: 'effects/fresnel',
    position: at(1020, 1230),
    inputValues: { power: float(3) },
  },
  reader('rim', 'property/vec3', 'rimColor', 1020, 1375),
  { id: 'mul4', type: 'math/multiply', position: at(1270, 1260) },
  {
    id: 'lerp2',
    type: 'interpolation/lerp',
    position: at(1540, 1150),
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

const EDGES: readonly SeedEdge[] = WIRES.map(([from, fromPort, to, toPort]) => ({
  id: `${from}.${fromPort}-${to}.${toPort}`,
  from: [from, fromPort],
  to: [to, toPort],
}))

export const TUTORIAL_NODE_COUNT = NODES.length + 1
export const TUTORIAL_EDGES = EDGES

export const TUTORIAL_GRAPH = graphDocumentV2(NODES, EDGES, PROPERTIES, at(1715, 520))
