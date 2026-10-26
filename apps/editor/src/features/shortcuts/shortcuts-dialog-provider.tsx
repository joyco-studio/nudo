import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'

import { ShortcutsDialog } from './shortcuts-dialog'
import { ShortcutsDialogContext } from './shortcuts-dialog-context'
import type { OpenShortcutsDialog } from './shortcuts-dialog-context'

interface ShortcutsDialogProviderProps {
  children: ReactNode
}

/** Owns the shortcuts dialog: opening it from anywhere and returning focus to what opened it. */
export function ShortcutsDialogProvider({ children }: ShortcutsDialogProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const openerRef = useRef<HTMLElement | null>(null)

  const openDialog = useCallback<OpenShortcutsDialog>((opener) => {
    openerRef.current = opener
    setIsOpen(true)
  }, [])

  const restoreFocus = useCallback(() => {
    focusOpenerOrCanvas(openerRef.current)
  }, [])

  return (
    <ShortcutsDialogContext value={openDialog}>
      {children}
      <ShortcutsDialog open={isOpen} onOpenChange={setIsOpen} restoreFocus={restoreFocus} />
    </ShortcutsDialogContext>
  )
}
