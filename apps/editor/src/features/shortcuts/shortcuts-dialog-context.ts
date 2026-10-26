import { createContext, use } from 'react'

/** Opens the shortcuts dialog. `opener` gets focus back when it closes. */
export type OpenShortcutsDialog = (opener: HTMLElement | null) => void

export const ShortcutsDialogContext = createContext<OpenShortcutsDialog | null>(null)

export function useOpenShortcutsDialog(): OpenShortcutsDialog {
  const openDialog = use(ShortcutsDialogContext)
  if (openDialog === null) {
    throw new Error('useOpenShortcutsDialog must be used inside ShortcutsDialogProvider')
  }
  return openDialog
}
