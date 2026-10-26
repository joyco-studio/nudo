import type { ParamValue } from '../types/graph'
import type { AnyNodeDefinition } from '../types/node-definition'

/**
 * Params as `build` sees them: every param the definition declares, with the stored value when
 * the node has one and the definition's default otherwise.
 */
export function resolveParams(
  definition: AnyNodeDefinition,
  stored: Readonly<Record<string, ParamValue>>,
): Readonly<Record<string, ParamValue>> {
  const defaults = (definition.params ?? []).map((param): [string, ParamValue] => [
    param.id,
    param.default,
  ])
  return { ...Object.fromEntries(defaults), ...stored }
}
