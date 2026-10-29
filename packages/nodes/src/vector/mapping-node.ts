import { concrete, defineNode, vec3 } from '@nudo-tsl/core'
import type { TslFacade } from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

/** Blender's four Mapping types: what the vector stands for decides how it is transformed. */
type MappingType = 'point' | 'texture' | 'vector' | 'normal'

const DEFAULT_TYPE: MappingType = 'point'

const TYPE_OPTIONS: readonly EnumOption<MappingType>[] = [
  { value: 'point', label: 'Point' },
  { value: 'texture', label: 'Texture' },
  { value: 'vector', label: 'Vector' },
  { value: 'normal', label: 'Normal' },
]

type Axis = 'x' | 'y' | 'z'

interface Rotation<E> {
  readonly cosine: E
  readonly sine: E
}

/** Turns `v` around one axis by the angle whose cosine and sine are given. */
function rotateAround<E>(tsl: TslFacade<E>, v: E, axis: Axis, { cosine, sine }: Rotation<E>): E {
  const x = tsl.swizzle(v, 'x')
  const y = tsl.swizzle(v, 'y')
  const z = tsl.swizzle(v, 'z')
  const turn = (a: E, b: E): readonly [E, E] => [
    tsl.sub(tsl.mul(a, cosine), tsl.mul(b, sine)),
    tsl.add(tsl.mul(a, sine), tsl.mul(b, cosine)),
  ]
  if (axis === 'x') {
    const [turnedY, turnedZ] = turn(y, z)
    return tsl.construct('vec3', [x, turnedY, turnedZ])
  }
  if (axis === 'y') {
    const [turnedZ, turnedX] = turn(z, x)
    return tsl.construct('vec3', [turnedX, y, turnedZ])
  }
  const [turnedX, turnedY] = turn(x, y)
  return tsl.construct('vec3', [turnedX, turnedY, z])
}

const AXES: readonly Axis[] = ['x', 'y', 'z']

/**
 * Blender's XYZ Euler rotation: around X first, then Y, then Z. The inverse undoes it, Z first,
 * with each angle negated (its sine flipped).
 */
function rotateEuler<E>(tsl: TslFacade<E>, v: E, rotation: E, inverse: boolean): E {
  const negate = tsl.construct('float', [-1])
  const turns = AXES.map((axis) => {
    const angle = tsl.swizzle(rotation, axis)
    const sine = tsl.sin(angle)
    return { axis, cosine: tsl.cos(angle), sine: inverse ? tsl.mul(sine, negate) : sine }
  })
  const ordered = inverse ? [...turns].reverse() : turns
  return ordered.reduce((turned, { axis, ...turn }) => rotateAround(tsl, turned, axis, turn), v)
}

interface MappingInputs<E> {
  readonly vector: E
  readonly location: E
  readonly rotation: E
  readonly scale: E
}

type MappingBuilder = <E>(tsl: TslFacade<E>, inputs: MappingInputs<E>) => E

const MAPPING_BUILDERS: Readonly<Record<MappingType, MappingBuilder>> = {
  point: (tsl, { vector, location, rotation, scale }) =>
    tsl.add(rotateEuler(tsl, tsl.mul(vector, scale), rotation, false), location),
  texture: (tsl, { vector, location, rotation, scale }) =>
    tsl.div(rotateEuler(tsl, tsl.sub(vector, location), rotation, true), scale),
  vector: (tsl, { vector, rotation, scale }) =>
    rotateEuler(tsl, tsl.mul(vector, scale), rotation, false),
  normal: (tsl, { vector, rotation, scale }) =>
    tsl.normalize(rotateEuler(tsl, tsl.div(vector, scale), rotation, false)),
}

export const mappingNode = defineNode({
  type: 'vector/mapping',
  category: 'vector',
  label: 'Mapping',
  description:
    "Moves, rotates and scales a 3D vector, like Blender's Mapping node, to place a texture.",
  formula: 'Rotate(In × Scale) + Loc',
  keywords: [
    'mapping',
    'transform',
    'translate',
    'rotate',
    'rotation',
    'scale',
    'location',
    'offset',
    'tiling',
    'blender',
  ],
  inputs: [
    {
      id: 'vector',
      label: 'In',
      type: concrete('vec3'),
      default: vec3(0, 0, 0),
      fallback: 'positionLocal',
      description: 'The vector to transform; the object position when nothing is plugged in.',
    },
    {
      id: 'location',
      label: 'Location',
      type: concrete('vec3'),
      default: vec3(0, 0, 0),
      description: 'How far to move it; Vector and Normal ignore it, as they have no position.',
    },
    {
      id: 'rotation',
      label: 'Rotation',
      type: concrete('vec3'),
      default: vec3(0, 0, 0),
      description: 'How far to turn it around X, then Y, then Z, in radians: 3.14 is half a turn.',
    },
    {
      id: 'scale',
      label: 'Scale',
      type: concrete('vec3'),
      default: vec3(1, 1, 1),
      description: 'How much to stretch it on each axis; 1 leaves it as it is.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec3'),
      description: 'The transformed vector.',
    },
  ],
  params: [
    {
      id: 'type',
      label: 'Type',
      kind: 'enum',
      options: TYPE_OPTIONS,
      default: DEFAULT_TYPE,
    },
  ],
  build: ({ tsl, inputs, params }) => {
    const type = resolveEnumParam(TYPE_OPTIONS, params.type, DEFAULT_TYPE)
    return { out: MAPPING_BUILDERS[type](tsl, inputs) }
  },
})
