import { findCommand } from '@/features/command-palette/command-registry'
import type { CommandId } from '@/features/command-palette/command-registry'
import { formatChord } from '@/features/shortcuts/key-chord'
import { ContextMenuShortcut } from '@/shared/ui/context-menu'

interface CommandMenuLabelProps {
  commandId: CommandId
}

/** A context menu item's text, from the registry: the command's menu name and its first chord. */
export function CommandMenuLabel({ commandId }: CommandMenuLabelProps) {
  const command = findCommand(commandId)
  if (command === undefined) return null
  const chord = command.shortcut[0]
  return (
    <>
      {command.menuLabel ?? command.label}
      {chord !== undefined && <ContextMenuShortcut>{formatChord(chord)}</ContextMenuShortcut>}
    </>
  )
}
