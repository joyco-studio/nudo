import { en } from './messages/en'

/** Every UI message, by key. English is the source: its keys are the dictionary's keys. */
export type MessageKey = keyof typeof en

/** A full dictionary: the compiler rejects one that misses an English key or adds its own. */
export type Messages = { readonly [K in MessageKey]: string }

/** The `{name}` placeholders of a message, as a union of their names. */
type PlaceholderNames<Text extends string> = Text extends `${string}{${infer Name}}${infer Rest}`
  ? Name | PlaceholderNames<Rest>
  : never

export type MessageParamValues<K extends MessageKey> = Readonly<
  Record<PlaceholderNames<(typeof en)[K]>, string | number>
>

/**
 * A message with placeholders takes its values; one without takes nothing. Distributes over a
 * union of keys, so a key only known as `MessageKey` (a hint, a menu label) needs no values.
 */
export type MessageParams<K extends MessageKey> = K extends MessageKey
  ? [PlaceholderNames<(typeof en)[K]>] extends [never]
    ? []
    : [params: MessageParamValues<K>]
  : never

/** Looks up a message in the current locale and fills in its `{name}` placeholders. */
export type Translate = <K extends MessageKey>(key: K, ...params: MessageParams<K>) => string

const PLACEHOLDER = /\{(\w+)\}/g

/** Replaces each `{name}` with its value; a name without a value stays as it is written. */
export function interpolate(
  template: string,
  values: Readonly<Record<string, string | number>> = {},
): string {
  return template.replace(PLACEHOLDER, (placeholder, name: string) => {
    const value = values[name]
    return value === undefined ? placeholder : String(value)
  })
}

export function createTranslator(messages: Messages): Translate {
  return (key, ...params) => interpolate(messages[key], params[0])
}

/** English, for text that searches in both languages and for UI rendered outside the provider. */
export const translateEnglish: Translate = createTranslator(en)

export function isMessageKey(key: string): key is MessageKey {
  return Object.hasOwn(en, key)
}

/** The placeholder names a message uses, for checking a translation keeps them all. */
export function placeholdersOf(text: string): readonly string[] {
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? '').sort()
}

/**
 * Which form of a counted message to use. English and Spanish share the rule: exactly one is
 * singular, every other count (0, 2, 1.5) is plural.
 */
export function pluralForm(count: number): 'one' | 'other' {
  return count === 1 ? 'one' : 'other'
}

/** The key of the form a count needs: `t(plural(n, { one, other }), { count: n })`. */
export function plural<K extends MessageKey>(
  count: number,
  forms: Readonly<Record<'one' | 'other', K>>,
): K {
  return forms[pluralForm(count)]
}
