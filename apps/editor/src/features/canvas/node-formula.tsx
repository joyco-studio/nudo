import { useRef, useState } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

/** Matches the title's description tooltip: the header is a drag handle, so tooltips wait. */
const FORMULA_DELAY_MS = 500
const FORMULA_OFFSET_PX = 8

function isTruncated(element: HTMLElement | null): boolean {
  return element !== null && element.scrollWidth > element.clientWidth
}

/**
 * The node's formula under its title (`A × B`): quiet mono text that ends in an ellipsis when it
 * does not fit, with the full formula in a tooltip only then. The Inspector shows it in full too.
 */
export function NodeFormula({ formula }: { formula: string }) {
  const textRef = useRef<HTMLParagraphElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Tooltip
      open={isOpen}
      delayDuration={FORMULA_DELAY_MS}
      onOpenChange={(next) => {
        setIsOpen(next && isTruncated(textRef.current))
      }}
    >
      <TooltipTrigger asChild>
        <p
          ref={textRef}
          data-node-formula
          className="-mt-1 truncate pb-0.5 font-mono text-micro leading-4 text-muted-foreground"
        >
          {formula}
        </p>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={FORMULA_OFFSET_PX}
        aria-hidden="true"
        className="pointer-events-none font-mono"
      >
        {formula}
      </TooltipContent>
    </Tooltip>
  )
}
