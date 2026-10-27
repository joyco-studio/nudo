import { isValidIdentifier } from '@nudo-tsl/core'
import type { BlackboardProperty } from '@nudo-tsl/core'

/** Core caps identifiers at 64 characters; room is left for a numeric suffix. */
const MAX_SUGGESTED_LENGTH = 64
const SUFFIX_ROOM = 4
const FIRST_SUFFIX = 2
const WORD_SEPARATOR = /[^A-Za-z0-9_$]+/
const ENDS_IN_DIGIT = /\d$/

/** `base1`, `base2`, … (`vec2_1` for a base ending in a digit): the first one nobody uses. */
export function defaultPropertyName(base: string, taken: ReadonlySet<string>): string {
  const separator = ENDS_IN_DIGIT.test(base) ? '_' : ''
  for (let count = 1; ; count += 1) {
    const name = `${base}${separator}${String(count)}`
    if (!taken.has(name)) return name
  }
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/** The first word lower-cased (fully, when it is an acronym like "UV"), the rest capitalized. */
function camelCase(words: readonly string[]): string {
  return words
    .map((word, index) => {
      if (index > 0) return capitalize(word)
      return word === word.toUpperCase()
        ? word.toLowerCase()
        : word.charAt(0).toLowerCase() + word.slice(1)
    })
    .join('')
}

function identifierFrom(label: string, fallback: string): string {
  const trimmed = label.trim()
  if (isValidIdentifier(trimmed)) return trimmed
  const words = trimmed.split(WORD_SEPARATOR).filter((word) => word !== '')
  if (words.length === 0) return fallback
  const candidate = camelCase(words).slice(0, MAX_SUGGESTED_LENGTH)
  if (isValidIdentifier(candidate)) return candidate
  // Starts with a digit, or is a reserved word: a leading underscore makes it usable.
  const prefixed = `_${candidate}`.slice(0, MAX_SUGGESTED_LENGTH)
  return isValidIdentifier(prefixed) ? prefixed : fallback
}

function withRoomForSuffix(name: string): string {
  return name.slice(0, MAX_SUGGESTED_LENGTH - SUFFIX_ROOM)
}

/**
 * The reference name a label suggests: the label itself when it is a valid identifier, otherwise
 * its words in camelCase (made valid when needed), numbered when another property uses it.
 */
export function suggestReferenceName(
  label: string,
  taken: ReadonlySet<string>,
  fallback: string,
): string {
  const base = identifierFrom(label, fallback)
  if (!taken.has(base)) return base
  for (let suffix = FIRST_SUFFIX; ; suffix += 1) {
    const name = `${withRoomForSuffix(base)}${String(suffix)}`
    if (!taken.has(name)) return name
  }
}

/**
 * Whether the reference still follows the label: it is what the label suggests, so it was
 * generated, not chosen by hand. Renaming the label then renames the reference too.
 */
export function followsLabel(
  property: Pick<BlackboardProperty, 'label' | 'name'>,
  takenByOthers: ReadonlySet<string>,
  fallback: string,
): boolean {
  return property.name === suggestReferenceName(property.label, takenByOthers, fallback)
}
