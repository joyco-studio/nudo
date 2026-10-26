import { concrete, defineNode, generic, vec4 } from '@nudo-tsl/core'
import type { DataType, Swizzle, TslFacade } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'
const VECTOR_ARITIES = ['vec2', 'vec3', 'vec4'] as const

const componentCount = (type: DataType): number => {
  switch (type) {
    case 'float':
      return 1
    case 'vec2':
      return 2
    case 'vec3':
      return 3
    case 'vec4':
      return 4
    case 'texture':
      return 0
  }
}

/** The component at `index` of the input, or a constant 0 when the input has fewer components. */
function componentOrZero<E>(
  tsl: TslFacade<E>,
  value: E,
  arity: number,
  index: number,
  component: Swizzle,
): E {
  if (index >= arity) return tsl.construct('float', [0])
  return tsl.swizzle(value, component)
}

export const splitNode = defineNode({
  type: 'vector/split',
  category: 'vector',
  label: 'Split',
  description: 'Splits a vector into its separate X, Y, Z and W components.',
  keywords: ['split', 'separate', 'break', 'components', 'swizzle', 'channels'],
  inputs: [
    {
      id: 'in',
      label: 'In',
      type: generic(TYPE_GROUP, VECTOR_ARITIES),
      default: vec4(0, 0, 0, 0),
    },
  ],
  outputs: [
    { id: 'x', label: 'X', type: concrete('float') },
    { id: 'y', label: 'Y', type: concrete('float') },
    { id: 'z', label: 'Z', type: concrete('float') },
    { id: 'w', label: 'W', type: concrete('float') },
  ],
  build: ({ tsl, inputs, resolvedTypes }) => {
    const arity = componentCount(resolvedTypes.in)
    return {
      x: componentOrZero(tsl, inputs.in, arity, 0, 'x'),
      y: componentOrZero(tsl, inputs.in, arity, 1, 'y'),
      z: componentOrZero(tsl, inputs.in, arity, 2, 'z'),
      w: componentOrZero(tsl, inputs.in, arity, 3, 'w'),
    }
  },
})
