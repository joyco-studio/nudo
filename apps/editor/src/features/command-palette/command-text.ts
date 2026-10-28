import { translateEnglish } from '@/i18n/translate'
import type { MessageKey, Translate } from '@/i18n/translate'

import type { Command, CommandId } from './command-registry'

/** The command's name in the palette and the shortcuts dialog. */
export function commandLabelKey(id: CommandId): MessageKey {
  return `command.${id}.label`
}

/** The command's name in a context menu: its short name, if it has one. */
export function commandMenuLabelKey(command: Command): MessageKey {
  return command.menuLabel ?? commandLabelKey(command.id)
}

function keywordsKey(id: CommandId): MessageKey {
  return `command.${id}.keywords`
}

/**
 * What a command is found by: its name and search words in the UI language, then in English, so
 * "split" still finds the split layout while the UI speaks Spanish.
 */
export function commandSearchText(command: Command, t: Translate): string {
  return [t, translateEnglish]
    .flatMap((translate) => [
      translate(commandLabelKey(command.id)),
      translate(keywordsKey(command.id)),
    ])
    .join(' ')
}
