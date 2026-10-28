import { describe, expect, it } from 'vitest'

import {
  iconSwapStates,
  listRowStates,
  pressFeedback,
  staggerDelayMs,
  surfaceStates,
  switchThumbTransition,
  textMorphStates,
  textMorphWidthTransition,
} from './motion-presets'
import { EASE } from './tokens'

describe('surfaceStates', () => {
  it('opens menus from 0.97 in 250ms and closes them to 0.99 in 150ms (reference 05)', () => {
    expect(surfaceStates('menu', 'full')).toEqual({
      hidden: { opacity: 0, transform: 'scale(0.97)' },
      visible: {
        opacity: 1,
        transform: 'scale(1)',
        transition: { duration: 0.25, ease: EASE.smoothOut },
      },
      exit: {
        opacity: 0,
        transform: 'scale(0.99)',
        transition: { duration: 0.15, ease: EASE.smoothOut },
      },
    })
  })

  it('opens dialogs from 0.96 in 250ms and closes them back to 0.96 in 150ms (reference 06)', () => {
    expect(surfaceStates('dialog', 'full')).toEqual({
      hidden: { opacity: 0, transform: 'scale(0.96)' },
      visible: {
        opacity: 1,
        transform: 'scale(1)',
        transition: { duration: 0.25, ease: EASE.smoothOut },
      },
      exit: {
        opacity: 0,
        transform: 'scale(0.96)',
        transition: { duration: 0.15, ease: EASE.smoothOut },
      },
    })
  })

  it('shows tooltips from 0.98 in 150ms ease-out and hides them in 50ms (reference 17)', () => {
    expect(surfaceStates('tooltip', 'full')).toEqual({
      hidden: { opacity: 0, transform: 'scale(0.98)' },
      visible: {
        opacity: 1,
        transform: 'scale(1)',
        transition: { duration: 0.15, ease: EASE.out },
      },
      exit: {
        opacity: 0,
        transform: 'scale(0.98)',
        transition: { duration: 0.05, ease: EASE.out },
      },
    })
  })

  it('fades a dialog backdrop with opacity only', () => {
    expect(surfaceStates('backdrop', 'full')).toEqual({
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.25, ease: EASE.smoothOut } },
      exit: { opacity: 0, transition: { duration: 0.15, ease: EASE.smoothOut } },
    })
  })

  it('gives frequent pointer-opened surfaces one fast opacity fade of 150ms', () => {
    expect(surfaceStates('quickFade', 'full')).toEqual({
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.15, ease: EASE.smoothOut } },
      exit: { opacity: 0, transition: { duration: 0.15, ease: EASE.smoothOut } },
    })
  })

  it('keeps only a short opacity fade under reduced motion', () => {
    expect(surfaceStates('menu', 'reduced')).toEqual({
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.15, ease: EASE.smoothOut } },
      exit: { opacity: 0, transition: { duration: 0.15, ease: EASE.smoothOut } },
    })
    expect(surfaceStates('tooltip', 'reduced').exit).toEqual({
      opacity: 0,
      transition: { duration: 0.05, ease: EASE.out },
    })
  })

  it('does not animate a keyboard-initiated open or close', () => {
    for (const preset of ['menu', 'dialog', 'tooltip', 'backdrop', 'quickFade'] as const) {
      expect(surfaceStates(preset, 'instant')).toEqual({
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      })
    }
  })
})

describe('iconSwapStates', () => {
  it('cross-fades icons symmetrically: 250ms ease-in-out, scale 0.25, 2px blur (reference 09)', () => {
    const swap = { duration: 0.25, ease: EASE.inOut }
    expect(iconSwapStates('full')).toEqual({
      hidden: { opacity: 0, transform: 'scale(0.25)', filter: 'blur(2px)' },
      visible: { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)', transition: swap },
      exit: { opacity: 0, transform: 'scale(0.25)', filter: 'blur(2px)', transition: swap },
    })
  })

  it('drops the scale and blur under reduced motion and is instant from the keyboard', () => {
    const fade = { duration: 0.15, ease: EASE.inOut }
    expect(iconSwapStates('reduced')).toEqual({
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: fade },
      exit: { opacity: 0, transition: fade },
    })
    expect(iconSwapStates('instant')).toEqual({
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0 } },
      exit: { opacity: 0, transition: { duration: 0 } },
    })
  })
})

describe('list rows', () => {
  it('enter with opacity and a 4px rise in 150ms, delayed by their stagger', () => {
    expect(listRowStates('full', 80)).toEqual({
      hidden: { opacity: 0, transform: 'translateY(4px)' },
      visible: {
        opacity: 1,
        transform: 'translateY(0px)',
        transition: { duration: 0.15, ease: EASE.smoothOut, delay: 0.08 },
      },
    })
    expect(listRowStates('reduced', 80)).toEqual({
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.15, ease: EASE.smoothOut, delay: 0.08 } },
    })
  })

  it('stagger 40ms only when several rows enter at once, with the total under 300ms', () => {
    expect(staggerDelayMs(0, 1)).toBe(0)
    expect(staggerDelayMs(0, 3)).toBe(0)
    expect(staggerDelayMs(2, 3)).toBe(80)
    expect(staggerDelayMs(20, 30)).toBeLessThan(300)
  })
})

describe('press feedback and the switch thumb', () => {
  it('presses buttons to 0.96 in 150ms ease-out and releases them back to full size', () => {
    const transition = { duration: 0.15, ease: EASE.out }
    expect(pressFeedback(true)).toEqual({ animate: { scale: 0.96 }, transition })
    expect(pressFeedback(false)).toEqual({ animate: { scale: 1 }, transition })
  })

  it('moves the switch thumb with the reference 27 overshoot, instantly without full motion', () => {
    expect(switchThumbTransition('full')).toEqual({ duration: 0.35, ease: [0.34, 1.35, 0.64, 1] })
    expect(switchThumbTransition('reduced')).toEqual({ duration: 0 })
    expect(switchThumbTransition('instant')).toEqual({ duration: 0 })
  })
})

describe('text morph', () => {
  it('cross-blurs the changing letters in 150ms and eases the width in 250ms (reference 33)', () => {
    const swap = { duration: 0.15, ease: EASE.smoothOut }
    expect(textMorphStates('full')).toEqual({
      hidden: { opacity: 0, filter: 'blur(2px)' },
      visible: { opacity: 1, filter: 'blur(0px)', transition: swap },
      exit: { opacity: 0, filter: 'blur(2px)', transition: swap },
    })
    expect(textMorphWidthTransition('full')).toEqual({ duration: 0.25, ease: EASE.smoothOut })
  })

  it('only fades under reduced motion and is instant from the keyboard', () => {
    const fade = { duration: 0.15, ease: EASE.smoothOut }
    expect(textMorphStates('reduced')).toEqual({
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: fade },
      exit: { opacity: 0, transition: fade },
    })
    expect(textMorphWidthTransition('reduced')).toEqual({ duration: 0 })
    expect(textMorphStates('instant').visible.transition).toEqual({ duration: 0 })
    expect(textMorphWidthTransition('instant')).toEqual({ duration: 0 })
  })
})
