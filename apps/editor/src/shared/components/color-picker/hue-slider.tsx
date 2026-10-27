import type { KeyboardEvent, PointerEvent } from 'react'

import { fractionAlong, valueForKey } from './slider-input'
import type { SliderRange } from './slider-input'

const PERCENT = 100
const HUE_RANGE: SliderRange = { min: 0, max: 360, step: 1, largeStep: 10 }
const HUE_TRACK =
  'linear-gradient(to right, #f00 0%, #ff0 16.67%, #0f0 33.33%, #0ff 50%, #00f 66.67%, #f0f 83.33%, #f00 100%)'

interface HueSliderProps {
  /** Degrees, 0..360. */
  hue: number
  onChange: (hue: number) => void
}

function fromPointer(event: PointerEvent<HTMLDivElement>): number {
  const box = event.currentTarget.getBoundingClientRect()
  return fractionAlong(event.clientX, box.left, box.width) * HUE_RANGE.max
}

/** The hue track. Dragging follows the pointer; the arrows move 1° (Shift: 10°). */
export function HueSlider({ hue, onChange }: HueSliderProps) {
  const degrees = Math.round(hue)

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    // Keeps the press from selecting text; focus moves here so the arrows continue the edit.
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    onChange(fromPointer(event))
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    onChange(fromPointer(event))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const next = valueForKey(event.key, event.shiftKey, hue, HUE_RANGE)
    if (next === null) return
    event.preventDefault()
    onChange(next)
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Hue"
      aria-valuemin={HUE_RANGE.min}
      aria-valuemax={HUE_RANGE.max}
      aria-valuenow={degrees}
      aria-valuetext={`${String(degrees)} degrees`}
      className="flex h-6 w-full cursor-pointer touch-none items-center select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    >
      {/* The track is drawn 12px tall inside a 24px hit area. */}
      <span
        aria-hidden="true"
        className="relative h-3 w-full border border-border"
        style={{ backgroundImage: HUE_TRACK }}
      >
        <span
          className="pointer-events-none absolute -inset-y-0.5 w-1.5 -translate-x-1/2 border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.6)]"
          style={{ left: `${String((hue / HUE_RANGE.max) * PERCENT)}%` }}
        />
      </span>
    </div>
  )
}
