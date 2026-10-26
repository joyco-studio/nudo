import type { Migration } from './migrate'

/**
 * Migrations from every released schema version to the next. `parseGraph` applies them when the
 * caller passes none.
 *
 * v1 to v2: adds the Blackboard. v1 documents never held properties, so `properties` is empty;
 * node params and everything else are unchanged (new params are optional and absent means default).
 */
export const DEFAULT_MIGRATIONS: readonly Migration[] = [
  { from: 1, migrate: (input) => ({ ...input, properties: [] }) },
]
