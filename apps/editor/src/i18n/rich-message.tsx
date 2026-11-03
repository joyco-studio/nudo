import { Fragment } from 'react'
import type { ReactNode } from 'react'

import type { en } from './messages/en'
import { LOCALE_MESSAGES } from './locale-messages'
import { messageParts } from './translate'
import type { MessageKey, PlaceholderNames } from './translate'
import { useCurrentLocale } from './use-t'

export interface RichMessageProps<K extends MessageKey> {
  messageKey: K
  /** One node per placeholder, such as `{ name: <strong>Claude</strong> }`. */
  values: Readonly<Record<PlaceholderNames<(typeof en)[K]>, ReactNode>>
}

function isPlaceholderOf<K extends MessageKey>(
  values: RichMessageProps<K>['values'],
  name: string,
): name is PlaceholderNames<(typeof en)[K]> & string {
  return Object.hasOwn(values, name)
}

/**
 * A message whose placeholders are elements, not strings: the sentence and its word order stay in
 * the dictionary, and the component styles each value. A placeholder without a value stays as
 * written, like `t` does.
 */
export function RichMessage<K extends MessageKey>({ messageKey, values }: RichMessageProps<K>) {
  const locale = useCurrentLocale()
  return messageParts(LOCALE_MESSAGES[locale][messageKey]).map((part, index) => (
    // The parts of one message never reorder.
    <Fragment key={index}>
      {part.kind === 'text'
        ? part.text
        : isPlaceholderOf(values, part.name)
          ? values[part.name]
          : `{${part.name}}`}
    </Fragment>
  ))
}
