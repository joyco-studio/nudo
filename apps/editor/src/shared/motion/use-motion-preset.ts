import { useCallback, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { Variants } from 'motion/react'

import { motionModeFor } from './motion-mode'
import {
  ICON_SWAP_VARIANTS,
  PANEL_REVEAL_VARIANTS,
  SURFACE_VARIANTS,
  TEXT_MORPH_VARIANTS,
} from './motion-presets'
import type { MotionMode, SurfacePreset } from './motion-presets'

/** Presets an overlay can open and close with. */
export type OverlayPreset = SurfacePreset | 'panelReveal'

export type MotionPreset = OverlayPreset | 'iconSwap' | 'textMorph'

/**
 * How much the change rendering now may move. Read during render on purpose: the render that opens,
 * closes or swaps something runs inside the key or pointer press that caused it, so a change
 * started from the keyboard is instant (the frequency gate) and reduced motion only fades.
 */
export function useMotionMode(): MotionMode {
  return motionModeFor(useReducedMotion() === true, document)
}

export interface PresenceMotion {
  /** For the `AnimatePresence` that mounts the element: nothing animates on first page load. */
  readonly presence: { readonly initial: false; readonly custom: MotionMode }
  /** For the motion element. An instant open renders straight at rest. */
  readonly element: {
    readonly variants: Variants
    readonly custom: MotionMode
    readonly initial: 'hidden' | false
    readonly animate: 'visible'
    readonly exit: 'exit'
  }
}

function variantsFor(preset: MotionPreset): Variants {
  if (preset === 'iconSwap') return ICON_SWAP_VARIANTS
  if (preset === 'textMorph') return TEXT_MORPH_VARIANTS
  if (preset === 'panelReveal') return PANEL_REVEAL_VARIANTS
  return SURFACE_VARIANTS[preset]
}

/** Props that animate an element in and out of an `AnimatePresence` with one preset. */
export function useMotionPreset(preset: MotionPreset): PresenceMotion {
  const mode = useMotionMode()
  return {
    presence: { initial: false, custom: mode },
    element: {
      variants: variantsFor(preset),
      custom: mode,
      initial: mode === 'instant' ? false : 'hidden',
      animate: 'visible',
      exit: 'exit',
    },
  }
}

export interface OverlayMotion {
  readonly presence: PresenceMotion['presence'] & { readonly onExitComplete: () => void }
  readonly element: PresenceMotion['element']
  /**
   * Key for the overlay's `AnimatePresence`. A close with nothing to animate (from the keyboard)
   * remounts it, so the overlay leaves in that same render rather than a frame later: focus is back
   * on the opener before the next key arrives, as with Radix's own unmount.
   */
  readonly presenceKey: number
  /** From an animated close until its exit ends. */
  readonly isLeaving: boolean
}

/** `useMotionPreset` for an overlay whose open state is `isOpen`. */
export function useOverlayMotion(preset: OverlayPreset, isOpen: boolean): OverlayMotion {
  const { presence, element } = useMotionPreset(preset)
  const [presenceKey, setPresenceKey] = useState(0)
  const [isLeaving, setIsLeaving] = useState(false)
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen)
    const closesInstantly = !isOpen && presence.custom === 'instant'
    setIsLeaving(!isOpen && !closesInstantly)
    if (closesInstantly) setPresenceKey((key) => key + 1)
  }
  const onExitComplete = useCallback(() => {
    setIsLeaving(false)
  }, [])
  return { presence: { ...presence, onExitComplete }, element, presenceKey, isLeaving }
}
