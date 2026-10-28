import { isKeyboardModality } from '@/shared/lib/input-modality'

import type { MotionMode } from './motion-presets'

/**
 * How much a change started now may move: instant when a key started it (the frequency gate),
 * only a fade with reduced motion, else the full token values. Not a hook, so an event handler or
 * a command can ask at the moment it runs; `useMotionMode` asks the same during render.
 */
export function motionModeFor(prefersReducedMotion: boolean, doc: Document): MotionMode {
  if (isKeyboardModality(doc)) return 'instant'
  return prefersReducedMotion ? 'reduced' : 'full'
}
