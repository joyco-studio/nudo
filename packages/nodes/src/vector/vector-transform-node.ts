import { concrete, defineNode, vec3 } from '@nudo-tsl/core'
import type { TransformKind, TransformSpace } from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

const TYPE_OPTIONS: readonly EnumOption<TransformKind>[] = [
  { value: 'point', label: 'Point' },
  { value: 'vector', label: 'Vector' },
  { value: 'normal', label: 'Normal' },
]

const SPACE_OPTIONS: readonly EnumOption<TransformSpace>[] = [
  { value: 'world', label: 'World' },
  { value: 'object', label: 'Object' },
  { value: 'camera', label: 'Camera' },
]

const DEFAULT_TYPE: TransformKind = 'vector'
const DEFAULT_FROM: TransformSpace = 'world'
const DEFAULT_TO: TransformSpace = 'object'

export const vectorTransformNode = defineNode({
  type: 'vector/vector-transform',
  category: 'vector',
  label: 'Vector Transform',
  description:
    "Carries a point, direction or normal from one space to another (world, object or camera), like Blender's Vector Transform.",
  formula: 'From → To',
  keywords: [
    'vector transform',
    'transform',
    'space',
    'world',
    'object',
    'local',
    'camera',
    'view',
    'matrix',
  ],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: concrete('vec3'),
      default: vec3(0, 0, 0),
      description: 'The point, direction or normal to carry over, in the From space.',
    },
  ],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec3'),
      description:
        'The same point, direction or normal in the To space; a vector keeps the length change of the object scale, a normal comes out length 1.',
    },
  ],
  params: [
    { id: 'type', label: 'Type', kind: 'enum', options: TYPE_OPTIONS, default: DEFAULT_TYPE },
    { id: 'from', label: 'From', kind: 'enum', options: SPACE_OPTIONS, default: DEFAULT_FROM },
    { id: 'to', label: 'To', kind: 'enum', options: SPACE_OPTIONS, default: DEFAULT_TO },
  ],
  build: ({ tsl, inputs, params }) => ({
    out: tsl.transform(
      resolveEnumParam(TYPE_OPTIONS, params.type, DEFAULT_TYPE),
      resolveEnumParam(SPACE_OPTIONS, params.from, DEFAULT_FROM),
      resolveEnumParam(SPACE_OPTIONS, params.to, DEFAULT_TO),
      inputs.in,
    ),
  }),
})
