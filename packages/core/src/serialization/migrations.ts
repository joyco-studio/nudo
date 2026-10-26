import type { Migration } from './migrate'

const isEmptyList = (value: unknown): boolean => Array.isArray(value) && value.length === 0

/**
 * Migrations from every released schema version to the next. `parseGraph` applies them when the
 * caller passes none.
 *
 * v1 to v2: adds the Blackboard. v1 documents never held properties, so `properties` must be
 * absent or an empty list and becomes `[]`; anything else is corrupt and fails the migration
 * (reported as an invalid `schemaVersion`). Node params and everything else are unchanged (new
 * params are optional and absent means default).
 */
export const DEFAULT_MIGRATIONS: readonly Migration[] = [
  {
    from: 1,
    migrate: (input) => {
      if (input.properties !== undefined && !isEmptyList(input.properties)) {
        throw new Error('A v1 document cannot hold properties')
      }
      return { ...input, properties: [] }
    },
  },
]
