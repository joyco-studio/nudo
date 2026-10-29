import type { Example, TemplateTag } from '@/examples'
import type { MessageKey } from '@/i18n/translate'

/** One line under the template's name: what it looks like. */
export const templateDescriptionKey = (example: Example): MessageKey =>
  `example.${example.id}.description`

/** One or two sentences on what building it teaches. */
export const templateTeachesKey = (example: Example): MessageKey => `example.${example.id}.teaches`

export const templateTagKey = (tag: TemplateTag): MessageKey => `templateTag.${tag}`
