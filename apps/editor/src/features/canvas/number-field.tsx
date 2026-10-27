import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

import { cn } from '@/shared/lib/utils'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { useFieldSize } from './field-size'
import type { FieldSize } from './field-size'
import { formatNumber, isNumberInput, parseNumberInput, stepNumber } from './parse-number-input'

const ARROW_STEP = 0.1
const SHIFT_ARROW_STEP = 1
/** Pixels the pointer must travel before a press on the label becomes a scrub. */
const SCRUB_THRESHOLD_PX = 3
const SCRUB_STEP_PER_PX = 0.01
const SHIFT_SCRUB_STEP_PER_PX = 0.1
/** The scrub hint waits, so it never flashes up while the pointer passes over a row. */
const SCRUB_HINT_DELAY_MS = 700

interface NumberFieldSizeClasses {
  readonly rowLabel: string
  readonly componentLabel: string
  readonly input: string
  readonly rowInputWidth: string
}

const SIZE_CLASSES: Readonly<Record<FieldSize, NumberFieldSizeClasses>> = {
  compact: {
    rowLabel: 'leading-6',
    componentLabel: 'w-2.5 text-micro',
    input: 'h-6 md:text-field',
    rowInputWidth: 'w-14',
  },
  comfortable: {
    rowLabel: 'leading-7',
    componentLabel: 'w-3 text-xs',
    input: 'h-7 md:text-xs',
    rowInputWidth: 'w-20',
  },
}

interface ScrubSession {
  readonly startX: number
  readonly startValue: number
  isScrubbing: boolean
}

export interface NumberFieldProps {
  /** Visible label. Dragging it sideways scrubs the value. */
  label: string
  /** Accessible name when the visible label alone is ambiguous (a vector's "X"). */
  accessibleName?: string
  value: number
  /** Never edited: shown muted so changed values stand out. */
  isDefault: boolean
  /** `row` fills a port row; `component` is one cell of a vector. */
  layout: 'row' | 'component'
  /** Scales every arrow and scrub step, for values on a larger scale (pixels). Defaults to 1. */
  stepScale?: number
  onCommit: (value: number) => void
  /** Called with every value of a pointer scrub, so the preview can follow before the commit. */
  onScrubPreview: (value: number) => void
  /** Called once a pointer scrub is over, whether it was committed or cancelled. */
  onScrubPreviewEnd: () => void
}

function scrubbedValue(session: ScrubSession, event: PointerEvent, stepScale: number): number {
  const stepPerPixel = (event.shiftKey ? SHIFT_SCRUB_STEP_PER_PX : SCRUB_STEP_PER_PX) * stepScale
  return stepNumber(session.startValue, (event.clientX - session.startX) * stepPerPixel)
}

/**
 * Inline number entry. Typing commits on Enter or blur, Escape reverts, and text that is not a
 * finite number reverts to the last valid value. ArrowUp/Down step by 0.1 (Shift: 1). Dragging
 * the label previews every value live and commits once, on release.
 */
export function NumberField({
  label,
  accessibleName,
  value,
  isDefault,
  layout,
  stepScale = 1,
  onCommit,
  onScrubPreview,
  onScrubPreviewEnd,
}: NumberFieldProps) {
  const inputId = useId()
  const sizeClasses = SIZE_CLASSES[useFieldSize()]
  const [draftText, setDraftText] = useState<string | null>(null)
  const [scrubValue, setScrubValue] = useState<number | null>(null)
  const scrubSession = useRef<ScrubSession | null>(null)

  const formatted = formatNumber(scrubValue ?? value)
  const text = draftText ?? formatted
  const isInvalid = draftText !== null && !isNumberInput(draftText)

  const commit = (next: number): void => {
    if (next !== value) onCommit(next)
  }

  const commitDraft = (): void => {
    if (draftText === null) return
    setDraftText(null)
    if (draftText.trim() === formatNumber(value)) return
    commit(parseNumberInput(draftText, value))
  }

  const step = (direction: 1 | -1, isLarge: boolean): void => {
    const base = draftText === null ? value : parseNumberInput(draftText, value)
    setDraftText(null)
    const arrowStep = (isLarge ? SHIFT_ARROW_STEP : ARROW_STEP) * stepScale
    commit(stepNumber(base, direction * arrowStep))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'Enter':
        event.preventDefault()
        commitDraft()
        return
      case 'Escape':
        setDraftText(null)
        return
      case 'ArrowUp':
      case 'ArrowDown':
        event.preventDefault()
        step(event.key === 'ArrowUp' ? 1 : -1, event.shiftKey)
        return
    }
  }

  const onScrubStart = (event: PointerEvent<HTMLLabelElement>): void => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    scrubSession.current = { startX: event.clientX, startValue: value, isScrubbing: false }
  }

  const onScrubMove = (event: PointerEvent<HTMLLabelElement>): void => {
    const session = scrubSession.current
    if (session === null) return
    if (!session.isScrubbing && Math.abs(event.clientX - session.startX) < SCRUB_THRESHOLD_PX) {
      return
    }
    session.isScrubbing = true
    const scrubbed = scrubbedValue(session, event, stepScale)
    setDraftText(null)
    setScrubValue(scrubbed)
    onScrubPreview(scrubbed)
  }

  const onScrubEnd = (event: PointerEvent<HTMLLabelElement>): void => {
    const session = scrubSession.current
    scrubSession.current = null
    setScrubValue(null)
    if (session?.isScrubbing !== true) return
    const finalValue = scrubbedValue(session, event, stepScale)
    // The uniform must end on the committed value even when the commit changes nothing.
    onScrubPreview(finalValue)
    commit(finalValue)
    onScrubPreviewEnd()
  }

  const onScrubCancel = (): void => {
    const session = scrubSession.current
    scrubSession.current = null
    setScrubValue(null)
    if (session?.isScrubbing !== true) return
    onScrubPreview(session.startValue)
    onScrubPreviewEnd()
  }

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1',
        layout === 'row' ? 'flex-1' : 'flex-1 basis-0',
      )}
    >
      <Tooltip delayDuration={SCRUB_HINT_DELAY_MS}>
        <TooltipTrigger asChild>
          <Label
            htmlFor={inputId}
            className={cn(
              'nodrag cursor-ew-resize touch-none font-normal select-none',
              layout === 'row'
                ? ['block min-w-0 flex-1 truncate text-xs', sizeClasses.rowLabel]
                : ['shrink-0 font-mono text-muted-foreground', sizeClasses.componentLabel],
            )}
            onPointerDown={onScrubStart}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubEnd}
            onPointerCancel={onScrubCancel}
          >
            {label}
          </Label>
        </TooltipTrigger>
        <TooltipContent side="top" aria-hidden="true" className="pointer-events-none">
          Drag to change
        </TooltipContent>
      </Tooltip>
      <Input
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-label={accessibleName}
        aria-invalid={isInvalid}
        value={text}
        onChange={(event) => {
          setDraftText(event.target.value)
        }}
        onBlur={commitDraft}
        onKeyDown={onKeyDown}
        className={cn(
          'nodrag min-w-0 border-border bg-background px-1 py-0 text-right font-mono text-base tabular-nums hover:border-muted-foreground dark:bg-background',
          sizeClasses.input,
          layout === 'row' ? [sizeClasses.rowInputWidth, 'shrink-0'] : 'w-full',
          isDefault && draftText === null ? 'text-muted-foreground' : 'text-foreground',
          isInvalid && 'border-destructive text-destructive hover:border-destructive',
          // The vendored Input's resting and invalid halos would crowd a 24px row.
          'aria-invalid:ring-0',
        )}
      />
    </div>
  )
}
