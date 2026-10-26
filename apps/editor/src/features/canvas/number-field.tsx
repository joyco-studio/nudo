import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

import { cn } from '@/shared/lib/utils'

import { formatNumber, isNumberInput, parseNumberInput, stepNumber } from './parse-number-input'

const ARROW_STEP = 0.1
const SHIFT_ARROW_STEP = 1
/** Pixels the pointer must travel before a press on the label becomes a scrub. */
const SCRUB_THRESHOLD_PX = 3
const SCRUB_STEP_PER_PX = 0.01
const SHIFT_SCRUB_STEP_PER_PX = 0.1

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
  onCommit: (value: number) => void
}

function scrubbedValue(session: ScrubSession, event: PointerEvent): number {
  const stepPerPixel = event.shiftKey ? SHIFT_SCRUB_STEP_PER_PX : SCRUB_STEP_PER_PX
  return stepNumber(session.startValue, (event.clientX - session.startX) * stepPerPixel)
}

/**
 * Inline number entry. Typing commits on Enter or blur, Escape reverts, and text that is not a
 * finite number reverts to the last valid value. ArrowUp/Down step by 0.1 (Shift: 1).
 */
export function NumberField({
  label,
  accessibleName,
  value,
  isDefault,
  layout,
  onCommit,
}: NumberFieldProps) {
  const inputId = useId()
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
    commit(stepNumber(base, direction * (isLarge ? SHIFT_ARROW_STEP : ARROW_STEP)))
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
    setDraftText(null)
    setScrubValue(scrubbedValue(session, event))
  }

  const onScrubEnd = (event: PointerEvent<HTMLLabelElement>): void => {
    const session = scrubSession.current
    scrubSession.current = null
    setScrubValue(null)
    if (session?.isScrubbing === true) commit(scrubbedValue(session, event))
  }

  const onScrubCancel = (): void => {
    scrubSession.current = null
    setScrubValue(null)
  }

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1',
        layout === 'row' ? 'flex-1' : 'flex-1 basis-0',
      )}
    >
      <label
        htmlFor={inputId}
        title="Drag to change"
        className={cn(
          'nodrag cursor-ew-resize touch-none select-none',
          layout === 'row'
            ? 'min-w-0 flex-1 truncate text-xs'
            : 'w-2.5 shrink-0 font-mono text-[10px] text-muted-foreground',
        )}
        onPointerDown={onScrubStart}
        onPointerMove={onScrubMove}
        onPointerUp={onScrubEnd}
        onPointerCancel={onScrubCancel}
      >
        {label}
      </label>
      <input
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
          'nodrag h-6 min-w-0 border border-border bg-background px-1 text-right font-mono text-[11px] tabular-nums hover:border-muted-foreground',
          layout === 'row' ? 'w-14 shrink-0' : 'w-full',
          isDefault && draftText === null ? 'text-muted-foreground' : 'text-foreground',
          isInvalid && 'border-destructive text-destructive hover:border-destructive',
        )}
      />
    </div>
  )
}
