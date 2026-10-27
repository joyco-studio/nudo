import { createContext, use } from 'react'

import type { CommandId } from './command-registry'

/**
 * Runs a registry command. `opener` is the element that had focus when it was asked for: node
 * commands act on its node, and a dialog the command opens gives focus back to it.
 */
export type RunCommand = (id: CommandId, opener: HTMLElement | null) => void

/** Opens the command palette. `opener` gets focus back when it closes. */
export type OpenCommandPalette = (opener: HTMLElement | null) => void

export interface CommandsApi {
  readonly runCommand: RunCommand
  readonly openCommandPalette: OpenCommandPalette
}

export const CommandsContext = createContext<CommandsApi | null>(null)

function useCommandsApi(): CommandsApi {
  const api = use(CommandsContext)
  if (api === null) throw new Error('Command hooks must be used inside CommandPaletteProvider')
  return api
}

export function useRunCommand(): RunCommand {
  return useCommandsApi().runCommand
}

export function useOpenCommandPalette(): OpenCommandPalette {
  return useCommandsApi().openCommandPalette
}
