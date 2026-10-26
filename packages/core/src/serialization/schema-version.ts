/** Version written by `serializeGraph` and expected by `parseGraph` after migrations. */
export const CURRENT_SCHEMA_VERSION = 1

export type ParseError =
  | { code: 'invalid-json' }
  /** `path` is dot-separated from the document root (`nodes.x.position.x`); `$` is the root. */
  | { code: 'invalid-shape'; path: string }
  | { code: 'unsupported-version'; version: number }
  | { code: 'unknown-node-type'; type: string }
