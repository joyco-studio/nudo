import { useEffect, useEffectEvent, useId, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { cn } from '@/shared/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

import { ColorFields } from './color-fields'
import {
  clampUnit,
  fromHsv,
  linearToSrgb,
  srgbToHex,
  srgbToHsv,
  srgbToLinear,
  withSrgb,
} from './color-math'
import type { PickerColor, Rgb } from './color-math'
import { HueSlider } from './hue-slider'
import { SaturationArea } from './saturation-area'

export interface ColorPickerProps {
  /** Linear RGB, 0..1 (graph space). Values above 1 are shown clamped until edited. */
  value: Rgb
  /** Every change while the picker is open, for a live preview. */
  onPreview: (value: Rgb) => void
  /** Once, when the picker closes by Enter or a press outside: one undo step. */
  onCommit: (value: Rgb) => void
  /** Escape: the last preview has already been put back to `value`. */
  onCancel: () => void
  /** Names the swatch and titles the picker. */
  label: string
  /** The swatch's id, so a visible `<Label htmlFor>` can point at it. */
  id?: string
  /** Extra classes for the swatch (for example `nodrag` inside a canvas node). */
  className?: string
}

interface PickerSession {
  readonly color: PickerColor
  /** False until the first change, so closing an untouched picker commits `value` exactly. */
  readonly isEdited: boolean
}

function colorOfLinear(linear: Rgb): PickerColor {
  const [red, green, blue] = linearToSrgb(linear)
  const srgb: Rgb = [clampUnit(red), clampUnit(green), clampUnit(blue)]
  return { srgb, hsv: srgbToHsv(srgb) }
}

/**
 * A swatch that opens a color picker: a saturation/brightness area, a hue slider and exact hex and
 * channel fields. Every edit previews live; Enter or a press outside commits once, and Escape
 * restores the color the picker opened with and returns focus to the swatch.
 */
export function ColorPicker({
  value,
  onPreview,
  onCommit,
  onCancel,
  label,
  id,
  className,
}: ColorPickerProps) {
  const titleId = useId()
  const hexId = useId()
  const [session, setSession] = useState<PickerSession | null>(null)
  const shownColor = session?.color ?? colorOfLinear(value)
  const shownHex = srgbToHex(shownColor.srgb)

  const edit = (color: PickerColor): void => {
    setSession({ color, isEdited: true })
    onPreview(srgbToLinear(color.srgb))
  }

  const commit = (): void => {
    if (session === null) return
    setSession(null)
    onCommit(session.isEdited ? srgbToLinear(session.color.srgb) : value)
  }

  const cancel = (): void => {
    if (session === null) return
    setSession(null)
    if (session.isEdited) onPreview(value)
    onCancel()
  }

  // Unmounting while open (the node is removed, the panel hides) ends the session like Escape,
  // so no live preview is left applied to the material.
  const cancelOnUnmount = useEffectEvent(cancel)
  useEffect(
    () => () => {
      cancelOnUnmount()
    },
    [],
  )

  const onContentKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // The picker is portalled out of its owner (a canvas node, say), but React still bubbles its
    // keys to the owner's handlers, which must not move or delete the node.
    event.stopPropagation()
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    // Buttons inside the picker (the eyedropper) keep Enter for themselves.
    if (event.target instanceof HTMLButtonElement) return
    event.preventDefault()
    commit()
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      <span id={hexId} aria-hidden="true" className="font-mono text-field text-muted-foreground">
        {shownHex}
      </span>
      <Popover
        modal
        open={session !== null}
        onOpenChange={(isOpen) => {
          if (isOpen) setSession({ color: colorOfLinear(value), isEdited: false })
          else commit()
        }}
      >
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            aria-label={label}
            aria-describedby={hexId}
            className={cn('size-6 shrink-0 border border-border', className)}
            style={{ backgroundColor: shownHex }}
          />
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          aria-labelledby={titleId}
          className="w-56 gap-2 p-3"
          onEscapeKeyDown={(event) => {
            event.preventDefault()
            cancel()
          }}
          onKeyDown={onContentKeyDown}
        >
          <p id={titleId} className="truncate text-xs font-medium">
            {label}
          </p>
          <SaturationArea
            hsv={shownColor.hsv}
            onChange={({ saturation, value: brightness }) => {
              edit(fromHsv({ ...shownColor.hsv, saturation, value: brightness }))
            }}
          />
          <HueSlider
            hue={shownColor.hsv.hue}
            onChange={(hue) => {
              edit(fromHsv({ ...shownColor.hsv, hue }))
            }}
          />
          <ColorFields
            srgb={shownColor.srgb}
            onChange={(srgb) => {
              edit(withSrgb(shownColor.hsv, srgb))
            }}
          />
        </PopoverContent>
      </Popover>
    </span>
  )
}
