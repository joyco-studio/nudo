import { useControllableState } from './use-controllable-state'

export interface ControllableOpenOptions {
  /** Controlled open state; leave undefined to let the component keep its own. */
  open?: boolean | undefined
  defaultOpen?: boolean | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
}

/**
 * The open state of an overlay root, controlled or not. Overlays animate their exit, so their
 * content must know the open state itself instead of leaving it to Radix.
 */
export function useControllableOpen({
  open,
  defaultOpen = false,
  onOpenChange,
}: ControllableOpenOptions): [isOpen: boolean, setOpen: (open: boolean) => void] {
  return useControllableState({ value: open, defaultValue: defaultOpen, onChange: onOpenChange })
}
