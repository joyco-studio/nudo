import type { KeyboardEvent, PointerEvent } from 'react'

import type { Hsv } from './color-math'
import { areaAxisForKey, fractionAlong, valueForKey } from './slider-input'
import type { SliderRange } from './slider-input'

const PERCENT = 100
const PERCENT_RANGE: SliderRange = { min: 0, max: PERCENT, step: 1, largeStep: 10 }

export interface SaturationValue {
  readonly saturation: number
  readonly value: number
}

interface SaturationAreaProps {
  hsv: Hsv
  onChange: (next: SaturationValue) => void
}

const toPercent = (unit: number): number => Math.round(unit * PERCENT)

function fromPointer(event: PointerEvent<HTMLDivElement>): SaturationValue {
  const box = event.currentTarget.getBoundingClientRect()
  return {
    saturation: fractionAlong(event.clientX, box.left, box.width),
    value: 1 - fractionAlong(event.clientY, box.top, box.height),
  }
}

/**
 * The 2D saturation (x) and brightness (y) field for the current hue. Dragging follows the
 * pointer; Left/Right change saturation and Up/Down brightness by 1% (Shift: 10%).
 */
export function SaturationArea({ hsv, onChange }: SaturationAreaProps) {
  const saturation = toPercent(hsv.saturation)
  const brightness = toPercent(hsv.value)

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
    const axis = areaAxisForKey(event.key)
    if (axis === null) return
    const current = axis === 'x' ? hsv.saturation : hsv.value
    const next = valueForKey(event.key, event.shiftKey, current * PERCENT, PERCENT_RANGE)
    if (next === null) return
    event.preventDefault()
    const unit = next / PERCENT
    onChange(
      axis === 'x'
        ? { saturation: unit, value: hsv.value }
        : { saturation: hsv.saturation, value: unit },
    )
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuemin={PERCENT_RANGE.min}
      aria-valuemax={PERCENT_RANGE.max}
      aria-valuenow={saturation}
      aria-valuetext={`Saturation ${String(saturation)}%, brightness ${String(brightness)}%`}
      className="relative h-32 w-full cursor-crosshair touch-none border border-border select-none"
      style={{
        backgroundColor: `hsl(${String(hsv.hue)} 100% 50%)`,
        backgroundImage:
          'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.6)]"
        style={{
          left: `${String(hsv.saturation * PERCENT)}%`,
          top: `${String((1 - hsv.value) * PERCENT)}%`,
        }}
      />
    </div>
  )
}
