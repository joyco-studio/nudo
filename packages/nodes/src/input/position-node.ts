import { concrete, defineNode } from '@nudo-tsl/core'
import type { BuiltinName } from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

type PositionSpace = 'object' | 'world' | 'view'

const DEFAULT_SPACE: PositionSpace = 'object'

const SPACE_OPTIONS: readonly EnumOption<PositionSpace>[] = [
  { value: 'object', label: 'Object' },
  { value: 'world', label: 'World' },
  { value: 'view', label: 'View' },
]

const SPACE_BUILTINS: Readonly<Record<PositionSpace, BuiltinName>> = {
  object: 'positionLocal',
  world: 'positionWorld',
  view: 'positionView',
}

export const positionNode = defineNode({
  type: 'input/position',
  category: 'input',
  label: 'Position',
  description: 'Position of the surface point, in object, world or view space.',
  keywords: ['position', 'vertex', 'object', 'world', 'view', 'space', 'coordinates'],
  inputs: [],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec3'),
      description: 'Where the surface point is, chosen in Space.',
    },
  ],
  params: [
    {
      id: 'space',
      label: 'Space',
      kind: 'enum',
      options: SPACE_OPTIONS,
      default: DEFAULT_SPACE,
    },
  ],
  build: ({ tsl, params }) => ({
    out: tsl.builtin(SPACE_BUILTINS[resolveEnumParam(SPACE_OPTIONS, params.space, DEFAULT_SPACE)]),
  }),
})
