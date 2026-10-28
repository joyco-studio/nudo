import type { AnyNodeDefinition, NodeCategory } from '@nudo-tsl/core'

import type { MessageKey } from '@/i18n/translate'
import { foldForSearch } from '@/shared/lib/fold-for-search'

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
  'logic',
  'vector',
  'effects',
  'texture',
  'color',
  'scene',
  'normal',
  'utility',
])

/** How the add-node menu and the command palette name each category. */
export function categoryLabelKey(category: AddableCategory): MessageKey {
  return `category.${category}`
}

export interface NodeSearchGroup {
  readonly category: AddableCategory
  readonly items: readonly AnyNodeDefinition[]
}

/** Property readers are added from the Blackboard, which gives them the property they read. */
const isAddable = (definition: AnyNodeDefinition): boolean => definition.reads !== 'property'

/**
 * The node matcher the add-node menu and the command palette share: the query, trimmed and
 * case- and accent-insensitive, appears anywhere in the node's label (or a node's own title), type id or a
 * keyword. Node names are short, so "ine" finding Sine and Cosine is what people expect. A
 * translated definition keeps its English label and keywords among its keywords, so both
 * languages find it.
 */
export function matchesNodeQuery(
  definition: AnyNodeDefinition,
  query: string,
  extraTexts: readonly string[] = [],
): boolean {
  const normalizedQuery = foldForSearch(query.trim())
  if (normalizedQuery === '') return true
  const texts = [...extraTexts, definition.label, definition.type, ...definition.keywords]
  return texts.some((text) => foldForSearch(text).includes(normalizedQuery))
}

/**
 * Case-insensitive search over label, keywords and type id. Results are grouped by category in
 * `NodeCategory` order, keep registry order inside a group, and leave out empty groups.
 */
export function searchNodes(
  definitions: readonly AnyNodeDefinition[],
  query: string,
): readonly NodeSearchGroup[] {
  const matches = definitions.filter(
    (definition) => isAddable(definition) && matchesNodeQuery(definition, query),
  )

  return ADDABLE_CATEGORIES.flatMap((category) => {
    const items = matches.filter((definition) => definition.category === category)
    return items.length === 0 ? [] : [{ category, items }]
  })
}
