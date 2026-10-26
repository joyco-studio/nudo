import type { AnyNodeDefinition } from '../types/node-definition'
import type { NodeTypeId } from '../types/ids'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'

export interface DuplicateTypeError {
  readonly code: 'duplicate-type'
  readonly type: NodeTypeId
}

export interface NodeRegistry {
  register(definition: AnyNodeDefinition): Result<void, DuplicateTypeError>
  get(type: NodeTypeId): AnyNodeDefinition | undefined
  /** All registered definitions, in insertion order. */
  list(): readonly AnyNodeDefinition[]
}

export function createNodeRegistry(): NodeRegistry {
  const definitions = new Map<NodeTypeId, AnyNodeDefinition>()

  return {
    register(definition) {
      if (definitions.has(definition.type)) {
        return err({ code: 'duplicate-type', type: definition.type })
      }
      definitions.set(definition.type, definition)
      return ok(undefined)
    },
    get: (type) => definitions.get(type),
    list: () => [...definitions.values()],
  }
}
