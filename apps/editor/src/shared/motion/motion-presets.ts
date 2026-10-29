import type { Variants } from 'motion/react'

import { BLUR_PX, DURATION_MS, EASE, SCALE, toSeconds } from './tokens'
import type { Ease } from './tokens'

/**
 * How much a change may move:
 * - `full`: the token values.
 * - `reduced` (prefers-reduced-motion): no transform or blur, only a short opacity fade.
 * - `instant`: nothing animates, for anything started from the keyboard (the frequency gate).
 */
export type MotionMode = 'full' | 'reduced' | 'instant'

/** Overlays that open and close: their enter and exit values. */
export type SurfacePreset = 'menu' | 'dialog' | 'tooltip' | 'backdrop' | 'quickFade'

// Type aliases rather than interfaces: motion/react's targets need their implicit index signature.
export type MotionTransition = {
  /** Seconds, as motion/react takes them. */
  readonly duration: number
  readonly ease?: Ease
  readonly delay?: number
}

export type MotionTarget = {
  readonly opacity: number
  readonly transform?: string
  readonly filter?: string
}

export type AnimatedTarget = MotionTarget & {
  readonly transition: MotionTransition
}

/** The variant names every preset uses with motion/react's `initial`, `animate` and `exit`. */
export interface PresenceStates {
  readonly hidden: MotionTarget
  readonly visible: AnimatedTarget
  readonly exit: AnimatedTarget
}

interface Phase {
  readonly durationMs: number
  readonly ease: Ease
  /** Omitted: the phase is opacity only. */
  readonly scale?: number
}

interface SurfaceSpec {
  readonly enter: Phase
  readonly exit: Phase
}

/** Reference 17: a tooltip leaves at once (`--tt-out-dur`). */
const TOOLTIP_EXIT_MS = 50
/** Reference 09: the scale an icon swaps from and to (`--icon-swap-start-scale`). */
const ICON_SWAP_SCALE = 0.25
/** better-ui "scale on press": always 0.96. */
const PRESS_SCALE = 0.96
/** Reference 07: how far a revealed panel travels (`--panel-translate-y`, here along x). */
const PANEL_REVEAL_TRAVEL_PX = 100
/** Reference 27: the switch thumb's travel and its overshoot curve (`--toggle-dur`, `--toggle-ease`). */
const SWITCH_THUMB_MS = 350
const SWITCH_THUMB_EASE: Ease = [0.34, 1.35, 0.64, 1]

/**
 * Open/close asymmetry (transitions-polish): surfaces open on `--duration-fast` and close faster on
 * `--duration-quick`; a close never bounces and never waits.
 */
const SURFACES: Readonly<Record<SurfacePreset, SurfaceSpec>> = {
  // Reference 05: popovers, selects and context menus grow from their trigger.
  menu: {
    enter: { durationMs: DURATION_MS.fast, ease: EASE.smoothOut, scale: SCALE.medium },
    exit: { durationMs: DURATION_MS.quick, ease: EASE.smoothOut, scale: SCALE.tiny },
  },
  // Reference 06: centered, back to the same scale on close.
  dialog: {
    enter: { durationMs: DURATION_MS.fast, ease: EASE.smoothOut, scale: SCALE.large },
    exit: { durationMs: DURATION_MS.quick, ease: EASE.smoothOut, scale: SCALE.large },
  },
  tooltip: {
    enter: { durationMs: DURATION_MS.quick, ease: EASE.out, scale: SCALE.small },
    exit: { durationMs: TOOLTIP_EXIT_MS, ease: EASE.out, scale: SCALE.small },
  },
  backdrop: {
    enter: { durationMs: DURATION_MS.fast, ease: EASE.smoothOut },
    exit: { durationMs: DURATION_MS.quick, ease: EASE.smoothOut },
  },
  // Surfaces opened many times a day (the add-node menu): one fast fade from the pointer.
  quickFade: {
    enter: { durationMs: DURATION_MS.quick, ease: EASE.smoothOut },
    exit: { durationMs: DURATION_MS.quick, ease: EASE.smoothOut },
  },
}

const INSTANT: MotionTransition = { duration: 0 }

function timed(durationMs: number, ease: Ease, delayMs = 0): MotionTransition {
  const transition = { duration: toSeconds(durationMs), ease }
  return delayMs > 0 ? { ...transition, delay: toSeconds(delayMs) } : transition
}

/** Reduced motion keeps a short fade: never longer than `--duration-quick`. */
function reducedTiming({ durationMs, ease }: Phase): MotionTransition {
  return timed(Math.min(durationMs, DURATION_MS.quick), ease)
}

function scaled(scale: number): string {
  return `scale(${String(scale)})`
}

function fadeStates(enter: MotionTransition, exit: MotionTransition): PresenceStates {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: enter },
    exit: { opacity: 0, transition: exit },
  }
}

export function surfaceStates(preset: SurfacePreset, mode: MotionMode): PresenceStates {
  const { enter, exit } = SURFACES[preset]
  if (mode === 'instant') return fadeStates(INSTANT, INSTANT)
  if (mode === 'reduced') return fadeStates(reducedTiming(enter), reducedTiming(exit))
  const enterTiming = timed(enter.durationMs, enter.ease)
  const exitTiming = timed(exit.durationMs, exit.ease)
  if (enter.scale === undefined) return fadeStates(enterTiming, exitTiming)
  return {
    hidden: { opacity: 0, transform: scaled(enter.scale) },
    visible: { opacity: 1, transform: scaled(1), transition: enterTiming },
    exit: {
      opacity: 0,
      transform: scaled(exit.scale ?? enter.scale),
      transition: exitTiming,
    },
  }
}

/**
 * Reference 07 (panel reveal), for a side sheet that enters from the left edge: a short slide,
 * a fade and a `--blur-small` cross-blur on one curve, `--duration-slow` in and `--duration-medium`
 * out. Pointer-opened only: from the keyboard the sheet is instant (the frequency gate).
 */
export function panelRevealStates(mode: MotionMode): PresenceStates {
  if (mode === 'instant') return fadeStates(INSTANT, INSTANT)
  if (mode === 'reduced') {
    return fadeStates(
      timed(DURATION_MS.quick, EASE.smoothOut),
      timed(DURATION_MS.quick, EASE.smoothOut),
    )
  }
  const away = {
    opacity: 0,
    transform: `translateX(-${String(PANEL_REVEAL_TRAVEL_PX)}px)`,
    filter: `blur(${String(BLUR_PX.small)}px)`,
  }
  return {
    hidden: away,
    visible: {
      opacity: 1,
      transform: 'translateX(0px)',
      filter: 'blur(0px)',
      transition: timed(DURATION_MS.slow, EASE.smoothOut),
    },
    exit: { ...away, transition: timed(DURATION_MS.medium, EASE.smoothOut) },
  }
}

/** Reference 09: two icons in one slot cross-fade with blur and scale, the same both ways. */
export function iconSwapStates(mode: MotionMode): PresenceStates {
  if (mode === 'instant') return fadeStates(INSTANT, INSTANT)
  if (mode === 'reduced') {
    const fade = timed(DURATION_MS.quick, EASE.inOut)
    return fadeStates(fade, fade)
  }
  const swap = timed(DURATION_MS.fast, EASE.inOut)
  const away = {
    opacity: 0,
    transform: scaled(ICON_SWAP_SCALE),
    filter: `blur(${String(BLUR_PX.small)}px)`,
  }
  return {
    hidden: away,
    visible: { opacity: 1, transform: scaled(1), filter: 'blur(0px)', transition: swap },
    exit: { ...away, transition: swap },
  }
}

/**
 * Reference 33 (text morph): the letters two labels don't share cross-blur in place while their
 * width eases ("Copy" to "Copied"). The reference's 180ms and 240ms sit on the token scale as
 * `--duration-quick` (text swap) and `--duration-fast`, with `--blur-small` (ruling P2-R12).
 */
export function textMorphStates(mode: MotionMode): PresenceStates {
  if (mode === 'instant') return fadeStates(INSTANT, INSTANT)
  const swap = timed(DURATION_MS.quick, EASE.smoothOut)
  if (mode === 'reduced') return fadeStates(swap, swap)
  const blurred = { opacity: 0, filter: `blur(${String(BLUR_PX.small)}px)` }
  return {
    hidden: blurred,
    visible: { opacity: 1, filter: 'blur(0px)', transition: swap },
    exit: { ...blurred, transition: swap },
  }
}

/** The width of the changing letters follows them only with full motion. */
export function textMorphWidthTransition(mode: MotionMode): MotionTransition {
  return mode === 'full' ? timed(DURATION_MS.fast, EASE.smoothOut) : INSTANT
}

const PRESS_TRANSITION: MotionTransition = timed(DURATION_MS.quick, EASE.out)

/**
 * better-ui press feedback for buttons, as motion/react's `animate` and `transition`. Driven by
 * pointer presses the caller tracks, not by `whileTap`: motion's tap gesture also answers Enter by
 * firing a synthetic `pointerdown`, which toggles Radix triggers a second time (ruling P2-R22).
 * Animates the `scale` value, so a button at rest has no transform at all.
 */
export function pressFeedback(isPressed: boolean) {
  return {
    animate: { scale: isPressed ? PRESS_SCALE : 1 },
    transition: PRESS_TRANSITION,
  } as const
}

export function switchThumbTransition(mode: MotionMode): MotionTransition {
  return mode === 'full' ? timed(SWITCH_THUMB_MS, SWITCH_THUMB_EASE) : INSTANT
}

/**
 * Hands a preset to motion/react as variants named `hidden`, `visible` and `exit`, resolved from the
 * element's `custom` mode. An element that is leaving keeps its last props, so its exit reads the
 * mode `AnimatePresence` passes at close time: an overlay closed with Escape leaves at once.
 */
export function presenceVariants(statesFor: (mode: MotionMode) => PresenceStates): Variants {
  return {
    hidden: (mode: MotionMode) => statesFor(mode).hidden,
    visible: (mode: MotionMode) => statesFor(mode).visible,
    exit: (mode: MotionMode) => statesFor(mode).exit,
  }
}

export const SURFACE_VARIANTS: Readonly<Record<SurfacePreset, Variants>> = {
  menu: presenceVariants((mode) => surfaceStates('menu', mode)),
  dialog: presenceVariants((mode) => surfaceStates('dialog', mode)),
  tooltip: presenceVariants((mode) => surfaceStates('tooltip', mode)),
  backdrop: presenceVariants((mode) => surfaceStates('backdrop', mode)),
  quickFade: presenceVariants((mode) => surfaceStates('quickFade', mode)),
}

export const ICON_SWAP_VARIANTS: Variants = presenceVariants(iconSwapStates)

export const PANEL_REVEAL_VARIANTS: Variants = presenceVariants(panelRevealStates)

export const TEXT_MORPH_VARIANTS: Variants = presenceVariants(textMorphStates)
