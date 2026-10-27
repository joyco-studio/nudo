import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'

import { useMotionPreset } from '@/shared/motion/use-motion-preset'

export interface IconSwapProps {
  /** Names the icon showing; a new key swaps the new icon in. */
  swapKey: string
  /** The icon for `swapKey`. */
  children: ReactNode
}

/**
 * Reference 09: icons sharing one slot (sun and moon, a collapse chevron) cross-fade with scale
 * and blur, both in one grid cell while they swap. Instant when the change came from a key.
 */
export function IconSwap({ swapKey, children }: IconSwapProps) {
  const { presence, element } = useMotionPreset('iconSwap')
  return (
    <span className="inline-grid shrink-0 place-items-center *:col-start-1 *:row-start-1">
      <AnimatePresence {...presence}>
        <motion.span key={swapKey} {...element} className="inline-flex">
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
