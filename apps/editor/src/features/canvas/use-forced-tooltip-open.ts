import { useState } from 'react'

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
 */
export function useForcedTooltipOpen(forced: ForcedTooltipOpen): TooltipOpenProps {
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
