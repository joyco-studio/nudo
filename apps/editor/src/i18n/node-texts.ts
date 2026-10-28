/** A param's name, and its options' names by option value. */
export interface ParamTexts {
  readonly label: string
  readonly options?: Readonly<Record<string, string>>
}

/**
 * A node's texts in one language, by port and param id. Anything left out keeps the definition's
 * English text, so a community node with no translation still reads fine.
 */
export interface NodeTexts {
  readonly label: string
  readonly description: string
  /** Search words in this language. The English label and keywords keep matching too. */
  readonly keywords: readonly string[]
  readonly inputs?: Readonly<Record<string, string>>
  readonly outputs?: Readonly<Record<string, string>>
  readonly params?: Readonly<Record<string, ParamTexts>>
}

/** Node texts by node type id. */
export type NodeTranslations = Readonly<Record<string, NodeTexts>>
