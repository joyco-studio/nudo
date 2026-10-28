import { useLayoutEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue } from 'motion/react'

import { splitTextMorph } from '@/shared/lib/split-text-morph'
import { TEXT_MORPH_VARIANTS, textMorphWidthTransition } from '@/shared/motion/motion-presets'
import type { MotionMode } from '@/shared/motion/motion-presets'
import { useMotionMode } from '@/shared/motion/use-motion-preset'

export interface TextMorphProps {
  /** The label to show; a new one morphs in from the last. */
  text: string
}

interface Morph {
  /** Counts label changes: each one remounts the two changing parts and replays the morph. */
  readonly id: number
  readonly previous: string
  readonly current: string
  /** Read when the label changed, inside the key or pointer press that changed it. */
  readonly mode: MotionMode
  /** The old letters are still blurring out; they unmount once gone. */
  readonly isLeaving: boolean
}

/**
 * Reference 33: a short label changing in place ("Copy" to "Copied"). The letters both labels share
 * stay put; the old middle blurs out while the new one blurs in, in one grid cell whose width eases
 * to the new middle. Instant when the change came from a key. Hidden from assistive technology: the
 * control carries the label as its accessible name.
 */
export function TextMorph({ text }: TextMorphProps) {
  const mode = useMotionMode()
  const [morph, setMorph] = useState<Morph>({
    id: 0,
    previous: text,
    current: text,
    mode,
    isLeaving: false,
  })
  if (morph.current !== text) {
    setMorph({ id: morph.id + 1, previous: morph.current, current: text, mode, isLeaving: true })
  }
  const finishLeaving = (id: number): void => {
    setMorph((latest) => (latest.id === id ? { ...latest, isLeaving: false } : latest))
  }

  const { head, outgoing, incoming, tail } = splitTextMorph(morph.previous, morph.current)
  const outgoingRef = useRef<HTMLSpanElement>(null)
  const incomingRef = useRef<HTMLSpanElement>(null)
  const width = useMotionValue(0)

  // Each new morph: the changing part starts as wide as the letters leaving and eases to the
  // letters arriving. Runs when the morph starts, while both are mounted.
  useLayoutEffect(() => {
    const leaving = outgoingRef.current
    const arriving = incomingRef.current
    if (morph.id === 0 || leaving === null || arriving === null) return
    width.jump(leaving.getBoundingClientRect().width)
    const controls = animate(
      width,
      arriving.getBoundingClientRect().width,
      textMorphWidthTransition(morph.mode),
    )
    return () => {
      controls.stop()
    }
  }, [morph.id, morph.mode, width])

  const isFirstRender = morph.id === 0
  return (
    <span aria-hidden="true" className="whitespace-nowrap">
      {head}
      <motion.span
        className="inline-grid justify-items-start align-bottom"
        style={{ width: isFirstRender ? 'auto' : width }}
      >
        {morph.isLeaving && (
          <motion.span
            key={`out-${String(morph.id)}`}
            ref={outgoingRef}
            variants={TEXT_MORPH_VARIANTS}
            custom={morph.mode}
            initial="visible"
            animate="exit"
            onAnimationComplete={() => {
              finishLeaving(morph.id)
            }}
            className="col-start-1 row-start-1 whitespace-pre"
          >
            {outgoing}
          </motion.span>
        )}
        <motion.span
          key={`in-${String(morph.id)}`}
          ref={incomingRef}
          variants={TEXT_MORPH_VARIANTS}
          custom={morph.mode}
          initial={isFirstRender ? false : 'hidden'}
          animate="visible"
          className="col-start-1 row-start-1 whitespace-pre"
        >
          {incoming}
        </motion.span>
      </motion.span>
      {tail}
    </span>
  )
}
