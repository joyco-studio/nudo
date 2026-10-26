import type { NodeDefinition } from '../types/node-definition'

/** Identity helper that infers input and output ids so `build` is checked against them. */
export function defineNode<const I extends string, const O extends string>(
  definition: NodeDefinition<I, O>,
): NodeDefinition<I, O> {
  return definition
}
