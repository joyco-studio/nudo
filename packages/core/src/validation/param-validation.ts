import type { ParamValue } from '../types/graph'
import type { AnyNodeDefinition } from '../types/node-definition'
import type { ParamDefinition } from '../types/param-definition'
import { UNIVERSAL_PARAMS } from '../types/param-definition'

/** Universal params win over a same-id declaration of the node, so their meaning is fixed. */
export function findParamDefinition(
  definition: AnyNodeDefinition,
  paramId: string,
): ParamDefinition | undefined {
  const universal = UNIVERSAL_PARAMS.find((param) => param.id === paramId)
  return universal ?? definition.params?.find((param) => param.id === paramId)
}

/**
 * Whether `value` fits the param: right kind, an option for enums, a finite number for numbers.
 * `min`/`max` are UI hints and are not enforced here.
 */
export function isValidParamValue(param: ParamDefinition, value: ParamValue): boolean {
  switch (param.kind) {
    case 'enum':
      return typeof value === 'string' && param.options.some((option) => option.value === value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
  }
}
