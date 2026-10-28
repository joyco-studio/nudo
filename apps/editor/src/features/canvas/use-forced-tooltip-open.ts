import { useState } from 'react'

import { useIsAnyOverlayOpen } from '@/shared/lib/overlay-coordinator'

export type ForcedTooltipOpen = boolean | null

interface TooltipOpenProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The always-controlled `open` and `onOpenChange` of a tooltip that something else can force:
 * `true` pins it open, `false` keeps it shut, `null` leaves it to hover and focus. The tooltip
 * is never uncontrolled, and whatever hover or focus did before a force began, or while one
 * held, is forgotten, so releasing the force never brings a stale tooltip back.
 *
 * An open menu, select, popover or dialog forces it shut and wins over `true`: the shared Tooltip
 * can only drop its own state when `open` is left to it, which a controlled tooltip never does.
 */
export function useForcedTooltipOpen(requested: ForcedTooltipOpen): TooltipOpenProps {
  const isOverlayOpen = useIsAnyOverlayOpen()
  const forced = isOverlayOpen ? false : requested
  const [isOpen, setIsOpen] = useState(false)
  const [previousForced, setPreviousForced] = useState(forced)
  if (previousForced !== forced) {
    setPreviousForced(forced)
    setIsOpen(false)
  }

  return {
    open: forced ?? isOpen,
    onOpenChange: (next) => {
      if (forced === null) setIsOpen(next)
    },
  }
}
