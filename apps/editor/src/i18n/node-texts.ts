/** A param's name, what a switch does (when the English one says), and its options' names. */
export interface ParamTexts {
  readonly label: string
  readonly description?: string
  readonly options?: Readonly<Record<string, string>>
}

/** A port's name, and what it means in its tooltip (when the English port has a description). */
export interface PortTexts {
  readonly label: string
  readonly description?: string
}

/**
 * A node's texts in one language, by port and param id. Anything left out keeps the definition's
 * English text, so a community node with no translation still reads fine.
 */
export interface NodeTexts {
  readonly label: string
  readonly description: string
  /** The formula under the title, when it names ports or uses words (`clamp(Entrada, Mín, Máx)`). */
  readonly formula?: string
  /** Search words in this language. The English label and keywords keep matching too. */
  readonly keywords: readonly string[]
  readonly inputs?: Readonly<Record<string, PortTexts>>
  readonly outputs?: Readonly<Record<string, PortTexts>>
  readonly params?: Readonly<Record<string, ParamTexts>>
}

/** Node texts by node type id. */
export type NodeTranslations = Readonly<Record<string, NodeTexts>>
