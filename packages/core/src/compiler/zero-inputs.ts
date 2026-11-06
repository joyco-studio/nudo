import type { GraphNode } from '../types/graph'
import type { AnyNodeDefinition, InputDefinition } from '../types/node-definition'

/**
 * Whether an `offAtZero` input is switched off: unconnected, and its stored value (or default) 0
 * in every component. The compiler hands such inputs to `build` as `zeroInputs`, and the topology
 * key tracks them, so a node that skips work for them recompiles when they leave 0.
 */
export function isInputOffAtZero(
  node: GraphNode,
  input: InputDefinition<string>,
  isConnected: boolean,
): boolean {
  if (input.offAtZero !== true || isConnected || input.fallback !== undefined) return false
  const stored = node.inputValues[input.id] ?? input.default
  if (stored.type === 'texture') return false
  const parts: readonly number[] = typeof stored.value === 'number' ? [stored.value] : stored.value
  return parts.every((part) => part === 0)
}

/** Whether any input of the definition can switch off at 0. */
export const hasOffAtZeroInputs = (definition: AnyNodeDefinition): boolean =>
  definition.inputs.some((input) => input.offAtZero === true)

/** The ids of the node's `offAtZero` inputs that are switched off. */
export function zeroInputIds(
  node: GraphNode,
  definition: AnyNodeDefinition,
  isConnected: (inputId: string) => boolean,
): ReadonlySet<string> {
  return new Set(
    definition.inputs
      .filter((input) => isInputOffAtZero(node, input, isConnected(input.id)))
      .map((input) => input.id),
  )
}
