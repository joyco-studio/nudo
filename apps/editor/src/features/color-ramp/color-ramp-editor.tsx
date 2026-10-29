import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { float, vec3 } from '@nudo-tsl/core'
import type { GraphNode, NodeId, PortRef } from '@nudo-tsl/core'
import { colorRampStopInputIds } from '@nudo-tsl/nodes'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'

import { useFieldSize } from '@/features/canvas/field-size'
import type { FieldSize } from '@/features/canvas/field-size'
import { useNodeFieldActions } from '@/features/canvas/node-field-actions'
import { formatNumber } from '@/features/canvas/parse-number-input'
import { useNodeRegistry } from '@/i18n/use-node-registry'
import { useT } from '@/i18n/use-t'
import { ColorPicker } from '@/shared/components/color-picker/color-picker'
import type { Rgb } from '@/shared/components/color-picker/color-math'
import { fractionAlong, valueForKey } from '@/shared/components/color-picker/slider-input'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { colorRampGradientCss } from './color-ramp-gradient'
import {
  addStop,
  insertedStopIndex,
  moveStop,
  removeStop,
  stopPositionRange,
  swapStops,
} from './color-ramp-operations'
import {
  COLOR_RAMP_MAX_STOPS,
  COLOR_RAMP_MIN_STOPS,
  colorRampInterpolation,
  readColorRampStops,
} from './color-ramp-stops'
import type { ColorRampStop } from './color-ramp-stops'

/** Keeps React Flow from dragging the node or handling the keys of a control in its body. */
const CANVAS_SAFE = 'nodrag nokey'

/**
 * Positions are edited in hundredths: arrows move 0.01, Shift + arrows and Page Up/Down 0.1, and
 * Home and End go to the neighbouring stops.
 */
const HUNDREDTHS = 100
const POSITION_RANGE_STEP = 1
const POSITION_RANGE_LARGE_STEP = 10

const REMOVE_KEYS: ReadonlySet<string> = new Set(['Delete', 'Backspace'])

const SIZE_CLASSES: Readonly<Record<FieldSize, { control: string; swatch: string }>> = {
  compact: { control: 'h-6 text-field', swatch: 'size-6' },
  comfortable: { control: 'h-7 text-xs', swatch: 'size-7' },
}

type StopControl = 'position' | 'color' | 'up' | 'down' | 'remove'
/** A row control focus can be sent to: `<row index>:<control>`. */
type FocusTarget = `${string}:${StopControl}`

/** Names a control so focus can be sent to it after an edit re-renders the rows. */
const FOCUS_ATTRIBUTE = 'data-ramp-control'

const focusAttribute = (target: FocusTarget) => ({ [FOCUS_ATTRIBUTE]: target })

const focusKey = (index: number, control: StopControl): FocusTarget => `${String(index)}:${control}`

interface StopDraft {
  readonly index: number
  readonly position?: number
  readonly color?: Rgb
}

function withDraft(stops: readonly ColorRampStop[], draft: StopDraft | null) {
  if (draft === null) return stops
  return stops.map((stop, index) =>
    index === draft.index
      ? { position: draft.position ?? stop.position, color: draft.color ?? stop.color }
      : stop,
  )
}

/** Where focus goes once a stop is removed: the row that took its place, else the one above. */
function focusAfterRemove(index: number, countAfter: number): FocusTarget {
  const row = Math.min(index, countAfter - 1)
  return focusKey(row, countAfter > COLOR_RAMP_MIN_STOPS ? 'remove' : 'position')
}

/** Focus follows the moved color; at an end of the list its button there is disabled. */
function focusAfterMove(target: number, count: number, direction: 'up' | 'down'): FocusTarget {
  if (direction === 'up') return focusKey(target, target === 0 ? 'down' : 'up')
  return focusKey(target, target === count - 1 ? 'up' : 'down')
}

interface IconActionProps {
  label: string
  tooltip: string
  disabled: boolean
  onPress: () => void
  focusTarget: FocusTarget
  children: ReactNode
}

function IconAction({ label, tooltip, disabled, onPress, focusTarget, children }: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...focusAttribute(focusTarget)}
          static
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          disabled={disabled}
          onClick={onPress}
          className={cn(CANVAS_SAFE, 'text-muted-foreground hover:text-foreground')}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

interface PositionSliderProps {
  label: string
  value: number
  /** Never edited: shown muted, like other fields, so changed values stand out. */
  isDefault: boolean
  min: number
  max: number
  onChange: (value: number) => void
  /** Delete or Backspace removes the stop; null while the ramp is at its fewest stops. */
  onRemove: (() => void) | null
  focusTarget: FocusTarget
}

/**
 * A stop's position as a slider (WAI-ARIA slider pattern): Left/Down and Right/Up step 0.01,
 * Shift + arrows and Page Up/Down step 0.1, Home and End go to the neighbouring stops. Delete
 * removes the stop.
 */
function PositionSlider({
  label,
  value,
  isDefault,
  min,
  max,
  onChange,
  onRemove,
  focusTarget,
}: PositionSliderProps) {
  const size = SIZE_CLASSES[useFieldSize()]
  const text = formatNumber(value)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (REMOVE_KEYS.has(event.key)) {
      event.preventDefault()
      onRemove?.()
      return
    }
    const isLarge = event.shiftKey && event.key.startsWith('Arrow')
    const range = {
      min: min * HUNDREDTHS,
      max: max * HUNDREDTHS,
      step: POSITION_RANGE_STEP,
      largeStep: POSITION_RANGE_LARGE_STEP,
    }
    const next = valueForKey(event.key, isLarge, value * HUNDREDTHS, range)
    if (next === null) return
    event.preventDefault()
    const position = next / HUNDREDTHS
    if (position !== value) onChange(position)
  }

  return (
    <div
      {...focusAttribute(focusTarget)}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation="horizontal"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={text}
      onKeyDown={onKeyDown}
      className={cn(
        CANVAS_SAFE,
        'flex w-12 shrink-0 cursor-default items-center justify-end border border-border bg-background px-1 font-mono tabular-nums select-none hover:border-muted-foreground',
        size.control,
        isDefault ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      {text}
    </div>
  )
}

/** In place of a control whose input is fed by a wire: its value comes from there. */
function WiredHint({ label, className }: { label: string; className: string }) {
  const t = useT()
  return (
    <span
      className={cn(
        'flex shrink-0 items-center font-mono text-muted-foreground',
        SIZE_CLASSES[useFieldSize()].control,
        className,
      )}
    >
      <span className="sr-only">{label}: </span>
      {t('colorRamp.wired')}
    </span>
  )
}

interface GradientBarProps {
  stops: readonly ColorRampStop[]
  css: string
  activeIndex: number | null
  /** Stops whose position is fed by a wire: their markers show it and cannot be dragged. */
  wiredPositions: ReadonlySet<number>
  /** Pointer drags of a marker; the rows' sliders are the keyboard path to the same edit. */
  onDrag: (index: number, position: number) => void
  onDragEnd: (index: number, position: number | null) => void
}

/** The ramp as the shader draws it, with a marker per stop that the pointer can drag. */
function GradientBar({
  stops,
  css,
  activeIndex,
  wiredPositions,
  onDrag,
  onDragEnd,
}: GradientBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const dragged = useRef<{ index: number; position: number | null } | null>(null)

  const positionAt = (index: number, clientX: number): number => {
    const rect = barRef.current?.getBoundingClientRect()
    const fraction = rect === undefined ? 0 : fractionAlong(clientX, rect.left, rect.width)
    const { min, max } = stopPositionRange(stops, index)
    return Math.min(max, Math.max(min, Math.round(fraction * HUNDREDTHS) / HUNDREDTHS))
  }

  const onPointerDown = (index: number) => (event: PointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragged.current = { index, position: null }
  }
  const onPointerMove = (event: PointerEvent<HTMLSpanElement>): void => {
    const drag = dragged.current
    if (drag === null) return
    const position = positionAt(drag.index, event.clientX)
    dragged.current = { index: drag.index, position }
    onDrag(drag.index, position)
  }
  const onPointerEnd = (): void => {
    const drag = dragged.current
    dragged.current = null
    if (drag !== null) onDragEnd(drag.index, drag.position)
  }

  return (
    // Decorative for assistive technology: every stop is a row below with its own controls.
    <div aria-hidden="true" className="px-1">
      <div
        ref={barRef}
        data-color-ramp-bar
        className="relative h-5 border border-border"
        style={{ backgroundImage: css }}
      >
        {stops.map((stop, index) => {
          const isWired = wiredPositions.has(index)
          return (
            <span
              key={index}
              data-active={activeIndex === index || undefined}
              data-wired={isWired || undefined}
              {...(isWired
                ? {}
                : {
                    onPointerDown: onPointerDown(index),
                    onPointerMove,
                    onPointerUp: onPointerEnd,
                    onPointerCancel: onPointerEnd,
                  })}
              className={cn(
                CANVAS_SAFE,
                'absolute -top-1 -bottom-1 w-1.5 -translate-x-1/2 border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.6)] data-[active]:w-2',
                // A wired position comes from the wire: a dashed, fixed marker.
                isWired
                  ? 'cursor-default border-dashed opacity-70'
                  : 'cursor-ew-resize touch-none before:absolute before:-inset-x-1.5 before:inset-y-0',
              )}
              style={{ left: `${String(stop.position * HUNDREDTHS)}%` }}
            />
          )
        })}
      </div>
    </div>
  )
}

export interface ColorRampEditorProps {
  node: GraphNode
  /** The node's inputs fed by an edge: their values come from the wire, not from the editor. */
  connectedInputs: ReadonlySet<string>
}

/**
 * The Color Ramp's stops: a gradient preview and one row per stop with its position, its color,
 * Move up / Move down (which trade colors, so positions stay in order) and Remove, then Add stop.
 * Every action is one undo step; moving a stop or picking a color only writes a uniform.
 */
export function ColorRampEditor({ node, connectedInputs }: ColorRampEditorProps) {
  const t = useT()
  const registry = useNodeRegistry()
  const size = SIZE_CLASSES[useFieldSize()]
  const { changeGraph, setInputValue, previewInputValue, endInputPreview } = useNodeFieldActions()
  const [draft, setDraft] = useState<StopDraft | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<FocusTarget | null>(null)

  const storedStops = readColorRampStops(node, registry)
  const stops = withDraft(storedStops, draft)
  const count = stops.length
  const nodeId: NodeId = node.id
  const wiredPositions = new Set(
    stops.flatMap((_, index) =>
      connectedInputs.has(colorRampStopInputIds(index).position) ? [index] : [],
    ),
  )

  // Rows are keyed by index, so after an edit focus is put where the edited stop went.
  useLayoutEffect(() => {
    const target = pendingFocus.current
    if (target === null) return
    pendingFocus.current = null
    rootRef.current?.querySelector<HTMLElement>(`[${FOCUS_ATTRIBUTE}="${target}"]`)?.focus()
  }, [node])

  const stopRef = (index: number, part: 'position' | 'color'): PortRef => ({
    nodeId,
    portId: colorRampStopInputIds(index)[part],
  })

  const add = (): void => {
    if (count + 1 >= COLOR_RAMP_MAX_STOPS) {
      pendingFocus.current = focusKey(insertedStopIndex(storedStops), 'position')
    }
    changeGraph((graph, nodeRegistry) => addStop(graph, nodeRegistry, nodeId))
  }
  const remove = (index: number): void => {
    pendingFocus.current = focusAfterRemove(index, count - 1)
    changeGraph((graph, nodeRegistry) => removeStop(graph, nodeRegistry, nodeId, index))
  }
  const move = (index: number, direction: 'up' | 'down'): void => {
    const target = direction === 'up' ? index - 1 : index + 1
    pendingFocus.current = focusAfterMove(target, count, direction)
    changeGraph((graph, nodeRegistry) => swapStops(graph, nodeRegistry, nodeId, index, target))
  }
  const setPosition = (index: number, position: number): void => {
    changeGraph((graph, nodeRegistry) => moveStop(graph, nodeRegistry, nodeId, index, position))
  }

  const dragPosition = (index: number, position: number): void => {
    setDraft({ index, position })
    previewInputValue(stopRef(index, 'position'), float(position))
  }
  const endDrag = (index: number, position: number | null): void => {
    setDraft(null)
    if (position !== null) setPosition(index, position)
    endInputPreview()
  }

  const previewColor = (index: number, color: Rgb): void => {
    setDraft({ index, color })
    previewInputValue(stopRef(index, 'color'), vec3(...color))
  }
  const commitColor = (index: number, color: Rgb): void => {
    setDraft(null)
    const current = storedStops[index]?.color
    const isSame = current?.every((channel, channelIndex) => channel === color[channelIndex])
    if (isSame !== true) setInputValue(stopRef(index, 'color'), vec3(...color))
    endInputPreview()
  }
  const cancelColor = (): void => {
    setDraft(null)
    endInputPreview()
  }

  return (
    <div ref={rootRef} data-color-ramp-editor className="flex flex-col gap-2 px-3 py-2">
      <GradientBar
        stops={stops}
        css={colorRampGradientCss(stops, colorRampInterpolation(node))}
        activeIndex={activeIndex}
        wiredPositions={wiredPositions}
        onDrag={dragPosition}
        onDragEnd={endDrag}
      />
      <ol aria-label={t('colorRamp.stops')} className="flex flex-col gap-1">
        {stops.map((stop, index) => {
          const number = index + 1
          const ids = colorRampStopInputIds(index)
          const { min, max } = stopPositionRange(stops, index)
          const positionLabel = t('colorRamp.position', { number })
          const colorLabel = t('colorRamp.color', { number })
          return (
            <li
              key={index}
              data-stop-index={index}
              onFocus={() => {
                setActiveIndex(index)
              }}
              onBlur={() => {
                setActiveIndex(null)
              }}
              className="flex items-center gap-2"
            >
              <span
                aria-hidden="true"
                className="w-3 shrink-0 font-mono text-micro text-muted-foreground"
              >
                {number}
              </span>
              {connectedInputs.has(ids.position) ? (
                <WiredHint label={positionLabel} className="w-12" />
              ) : (
                <PositionSlider
                  label={positionLabel}
                  value={stop.position}
                  isDefault={node.inputValues[ids.position] === undefined}
                  min={min}
                  max={max}
                  onChange={(position) => {
                    setPosition(index, position)
                  }}
                  onRemove={
                    count > COLOR_RAMP_MIN_STOPS
                      ? () => {
                          remove(index)
                        }
                      : null
                  }
                  focusTarget={focusKey(index, 'position')}
                />
              )}
              <span className="flex min-w-0 flex-1 justify-end">
                {connectedInputs.has(ids.color) ? (
                  <WiredHint label={colorLabel} className="justify-end" />
                ) : (
                  <ColorPicker
                    label={colorLabel}
                    value={stop.color}
                    className={cn(CANVAS_SAFE, size.swatch)}
                    onPreview={(color) => {
                      previewColor(index, color)
                    }}
                    onCommit={(color) => {
                      commitColor(index, color)
                    }}
                    onCancel={cancelColor}
                  />
                )}
              </span>
              <span className="flex shrink-0">
                <IconAction
                  label={t('colorRamp.moveUpStop', { number })}
                  tooltip={t('colorRamp.moveUp')}
                  disabled={index === 0}
                  onPress={() => {
                    move(index, 'up')
                  }}
                  focusTarget={focusKey(index, 'up')}
                >
                  <ChevronUp aria-hidden="true" />
                </IconAction>
                <IconAction
                  label={t('colorRamp.moveDownStop', { number })}
                  tooltip={t('colorRamp.moveDown')}
                  disabled={index === count - 1}
                  onPress={() => {
                    move(index, 'down')
                  }}
                  focusTarget={focusKey(index, 'down')}
                >
                  <ChevronDown aria-hidden="true" />
                </IconAction>
                <IconAction
                  label={t('colorRamp.removeStop', { number })}
                  tooltip={t('colorRamp.remove')}
                  disabled={count <= COLOR_RAMP_MIN_STOPS}
                  onPress={() => {
                    remove(index)
                  }}
                  focusTarget={focusKey(index, 'remove')}
                >
                  <X aria-hidden="true" />
                </IconAction>
              </span>
            </li>
          )
        })}
      </ol>
      <Button
        static
        type="button"
        variant="ghost"
        size="sm"
        disabled={count >= COLOR_RAMP_MAX_STOPS}
        onClick={add}
        className={cn(CANVAS_SAFE, '-ml-2.5 h-7 self-start text-xs')}
      >
        <Plus aria-hidden="true" className="size-3.5" />
        {t('colorRamp.add')}
      </Button>
    </div>
  )
}
