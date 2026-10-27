/**
 * The transitions.dev motion-token scale, the single source of motion values (ruling P2-R12). It
 * mirrors `motion-tokens.css` value for value (a unit test holds them together), so motion/react
 * variants and any remaining CSS animation read the same numbers.
 */

/** A cubic-bezier curve, as motion/react and CSS `cubic-bezier()` take it, or linear. */
export type Ease = readonly [number, number, number, number] | 'linear'

export const DURATION_MS = {
  /** Per-item stagger offset. */
  stagger: 40,
  /** Tooltip intent delay, large stagger. */
  micro: 80,
  /** Modal and dropdown close, text swap, tooltip appear. */
  quick: 150,
  /** Icon swap, dropdown and modal open, accordion. */
  fast: 250,
  /** Panel close, toast close. */
  medium: 350,
  /** Panel open. */
  slow: 400,
  /** Emphasis moments. */
  verySlow: 500,
} as const

export const EASE = {
  /** Surfaces opening and closing, position changes. */
  smoothOut: [0.22, 1, 0.36, 1],
  /** CSS `ease-in-out`: icon and text swaps. */
  inOut: [0.42, 0, 0.58, 1],
  /** CSS `ease-out`: tooltips. */
  out: [0, 0, 0.58, 1],
  linear: 'linear',
  /** Badge pop open. */
  bounce: [0.34, 1.36, 0.64, 1],
  /** Bouncy hover-out. */
  bounceStrong: [0.34, 3.85, 0.64, 1],
} as const satisfies Record<string, Ease>

export const DISTANCE_PX = {
  /** Text swap, list rows. */
  micro: 4,
  small: 6,
  base: 8,
  medium: 12,
  large: 30,
} as const

/** The non-resting scale a surface animates from (or to); it always settles at 1. */
export const SCALE = {
  /** Modal open and close. */
  large: 0.96,
  /** Dropdown open. */
  medium: 0.97,
  /** Tooltip open. */
  small: 0.98,
  /** Dropdown close. */
  tiny: 0.99,
} as const

export const BLUR_PX = {
  /** Panel reveal, icon swap, text swap. */
  small: 2,
  medium: 3,
  large: 8,
} as const

/** motion/react takes durations in seconds. */
export function toSeconds(milliseconds: number): number {
  return milliseconds / 1000
}
