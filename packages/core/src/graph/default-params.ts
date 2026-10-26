import type { ParamValue } from '../types/graph'
import type { AnyNodeDefinition } from '../types/node-definition'
import { UNIVERSAL_PARAM_IDS } from '../types/param-definition'

/**
 * Enum and boolean params start at their default; string and number params stay absent. Universal
 * params are never written: absence means the default.
 */
export function defaultParams(definition: AnyNodeDefinition): Readonly<Record<string, ParamValue>> {
  const defaults = (definition.params ?? []).flatMap((param): [string, ParamValue][] => {
    const isDefaulted = param.kind === 'enum' || param.kind === 'boolean'
    return isDefaulted && !UNIVERSAL_PARAM_IDS.has(param.id) ? [[param.id, param.default]] : []
  })
  return Object.fromEntries(defaults)
}
