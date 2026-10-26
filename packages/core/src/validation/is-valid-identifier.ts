const MAX_IDENTIFIER_LENGTH = 64
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** ES reserved words (including strict-mode and module ones) plus names that are ambiguous in TSL. */
const RESERVED_NAMES: ReadonlySet<string> = new Set([
  'arguments',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'undefined',
  'NaN',
  'Infinity',
])

/** Whether `name` can be used as a JS variable name: identifier syntax, not reserved, ≤ 64 chars. */
export function isValidIdentifier(name: string): boolean {
  return (
    name.length <= MAX_IDENTIFIER_LENGTH &&
    IDENTIFIER_PATTERN.test(name) &&
    !RESERVED_NAMES.has(name)
  )
}
