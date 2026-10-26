import type { AnyNodeDefinition, NodeCategory } from '@nudo-tsl/core'

/** The categories a person can add from, in `NodeCategory` order. The master is never added. */
export type AddableCategory = Exclude<NodeCategory, 'master'>

/** Type-checks only when `order` lists every addable category, so a new one can't go missing. */
function exhaustiveOrder<const T extends readonly AddableCategory[]>(
  order: T & ([Exclude<AddableCategory, T[number]>] extends [never] ? unknown : never),
): T {
  return order
}

export const ADDABLE_CATEGORIES = exhaustiveOrder([
  'input',
  'math',
  'interpolation',
  'vector',
  'effects',
  'texture',
  'utility',
])

export interface NodeSearchGroup {
  readonly category: AddableCategory
  readonly items: readonly AnyNodeDefinition[]
}

function matchesQuery(definition: AnyNodeDefinition, normalizedQuery: string): boolean {
  if (normalizedQuery === '') return true
  const haystack = [definition.label, definition.type, ...definition.keywords]
  return haystack.some((text) => text.toLowerCase().includes(normalizedQuery))
}

/**
 * Case-insensitive search over label, keywords and type id. Results are grouped by category in
 * `NodeCategory` order, keep registry order inside a group, and leave out empty groups.
 */
export function searchNodes(
  definitions: readonly AnyNodeDefinition[],
  query: string,
): readonly NodeSearchGroup[] {
  const normalizedQuery = query.trim().toLowerCase()
  const matches = definitions.filter((definition) => matchesQuery(definition, normalizedQuery))

  return ADDABLE_CATEGORIES.flatMap((category) => {
    const items = matches.filter((definition) => definition.category === category)
    return items.length === 0 ? [] : [{ category, items }]
  })
}
