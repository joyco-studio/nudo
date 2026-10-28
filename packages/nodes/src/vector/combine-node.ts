import { concrete, defineNode, float } from '@nudo-tsl/core'

export const combineNode = defineNode({
  type: 'vector/combine',
  category: 'vector',
  label: 'Combine',
  description: 'Builds a 2, 3 or 4 component vector from separate X, Y, Z and W values.',
  formula: 'X, Y, Z, W → Vec2 / 3 / 4',
  keywords: ['combine', 'merge', 'join', 'compose', 'construct', 'vector'],
  inputs: [
    {
      id: 'x',
      label: 'X',
      type: concrete('float'),
      default: float(0),
      description: 'The first component: red for a color.',
    },
    {
      id: 'y',
      label: 'Y',
      type: concrete('float'),
      default: float(0),
      description: 'The second component: green for a color.',
    },
    {
      id: 'z',
      label: 'Z',
      type: concrete('float'),
      default: float(0),
      description: 'The third component: blue for a color; Vec2 leaves it out.',
    },
    {
      id: 'w',
      label: 'W',
      type: concrete('float'),
      default: float(0),
      description: 'The fourth component: alpha for a color; only Vec4 uses it.',
    },
  ],
  outputs: [
    { id: 'vec2', label: 'Vec2', type: concrete('vec2'), description: 'X and Y as one vec2.' },
    { id: 'vec3', label: 'Vec3', type: concrete('vec3'), description: 'X, Y and Z as one vec3.' },
    {
      id: 'vec4',
      label: 'Vec4',
      type: concrete('vec4'),
      description: 'X, Y, Z and W as one vec4.',
    },
  ],
  build: ({ tsl, inputs }) => ({
    vec2: tsl.construct('vec2', [inputs.x, inputs.y]),
    vec3: tsl.construct('vec3', [inputs.x, inputs.y, inputs.z]),
    vec4: tsl.construct('vec4', [inputs.x, inputs.y, inputs.z, inputs.w]),
  }),
})
