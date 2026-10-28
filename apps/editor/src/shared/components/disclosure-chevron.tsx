import { ChevronDown } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

export interface DisclosureChevronProps {
  /** Whether the disclosed content is showing: the chevron points down, otherwise it turns away. */
  isOpen: boolean
  className?: string
}

const OPEN_ROTATION = 'rotate(0deg)'
const CLOSED_ROTATION = 'rotate(-90deg)'

/**
 * One chevron that rotates between open and closed (ruling P2-R24), unlike `IconSwap`, which is
 * for icons that really change. A CSS transition rather than motion/react, on `transform` alone;
 * instant under `prefers-reduced-motion`, and the theme switch's transition suppression wins too.
 */
export function DisclosureChevron({ isOpen, className }: DisclosureChevronProps) {
  return (
    <ChevronDown
      aria-hidden="true"
      style={{ transform: isOpen ? OPEN_ROTATION : CLOSED_ROTATION }}
      className={cn(
        'transition-[transform] duration-(--duration-fast) ease-(--ease-smooth-out) motion-reduce:duration-0',
        className,
      )}
    />
  )
}
