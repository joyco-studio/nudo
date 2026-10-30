import { concrete, defineNode } from '@nudo-tsl/core'
import type { BuiltinName } from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

type NormalSpace = 'world' | 'object' | 'view'

const DEFAULT_SPACE: NormalSpace = 'world'

const SPACE_OPTIONS: readonly EnumOption<NormalSpace>[] = [
  { value: 'world', label: 'World' },
  { value: 'object', label: 'Object' },
  { value: 'view', label: 'View' },
]

/**
 * World and view normals follow the material's Normal input once one is connected; the object
 * normal is the mesh's own, so it is the one to displace vertices along.
 */
const SPACE_BUILTINS: Readonly<Record<NormalSpace, BuiltinName>> = {
  world: 'normalWorld',
  object: 'normalLocal',
  view: 'normalView',
}

export const normalNode = defineNode({
  type: 'input/normal',
  category: 'input',
  label: 'Normal',
  description:
    "The direction the surface faces, in world, object or view space. Object is the mesh's own normal: use it to move vertices.",
  keywords: ['normal', 'surface', 'direction', 'world', 'object', 'view'],
  inputs: [],
  outputs: [
    {
      id: 'out',
      label: 'Out',
      type: concrete('vec3'),
      description: 'The surface direction in the chosen space, with a length of 1.',
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
