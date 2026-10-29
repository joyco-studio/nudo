import { useId } from 'react'
import type { ReactElement } from 'react'
import { UNIVERSAL_PARAM_IDS } from '@nudo-tsl/core'
import type { GraphNode, ParamDefinition } from '@nudo-tsl/core'

import { cn } from '@/shared/lib/utils'
import { OptionSelect } from '@/shared/components/option-select'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { useFieldSize } from './field-size'
import type { FieldSize } from './field-size'
import { useNodeFieldActions } from './node-field-actions'
import { isIdlePhysicalSwitch } from './node-port-layout'
import { NumberField } from './number-field'
import type { BooleanParam, EnumParam, NumberParam } from './param-kinds'

/** The params a node body edits. String params, and hidden number params, are editor-managed. */
export type BodyParam = EnumParam | BooleanParam | NumberParam

function isBodyParam(param: ParamDefinition): param is BodyParam {
  if (UNIVERSAL_PARAM_IDS.has(param.id)) return false
  if (param.kind === 'number') return param.hidden !== true
  return param.kind === 'enum' || param.kind === 'boolean'
}

/**
 * The params a node shows in its body, in definition order. The master's physical feature
 * switches show only while its lighting is physical: no other material reads them.
 */
export function bodyParams(
  node: GraphNode,
  params: readonly ParamDefinition[] | undefined,
): readonly BodyParam[] {
  return (params ?? []).filter(isBodyParam).filter((param) => !isIdlePhysicalSwitch(node, param.id))
}

/**
 * Off, the switch is an outline with a muted thumb: the filled off track (the input token) would
 * vanish against the node card in light. Muted foreground holds 3:1+ on the card in both themes.
 */
const SWITCH_OUTLINE_WHEN_OFF =
  'data-unchecked:border-muted-foreground data-unchecked:bg-transparent dark:data-unchecked:bg-transparent *:data-unchecked:bg-muted-foreground dark:*:data-unchecked:bg-muted-foreground'

interface ParamSizeClasses {
  readonly row: string
  readonly label: string
  readonly select: string
  readonly switchSize: 'sm' | 'default'
  /** Pulls the small switch's grown hit area clear of the node edge. */
  readonly switchInset: string
}

const SIZE_CLASSES: Readonly<Record<FieldSize, ParamSizeClasses>> = {
  compact: {
    row: 'h-7 pr-2 pl-3',
    label: 'leading-7',
    select: 'w-28',
    switchSize: 'sm',
    switchInset: 'mr-1',
  },
  comfortable: {
    row: 'h-9 px-3',
    label: 'leading-9',
    select: 'w-36 data-[size=sm]:h-7 md:text-xs',
    switchSize: 'default',
    switchInset: '',
  },
}

const ROW_CLASS = 'flex items-center gap-2'
const LABEL_CLASS = 'block min-w-0 flex-1 truncate text-xs font-normal'

interface ParamFieldProps<P extends BodyParam> {
  node: GraphNode
  param: P
}

function EnumParamField({ node, param }: ParamFieldProps<EnumParam>) {
  const { setParam } = useNodeFieldActions()
  const sizeClasses = SIZE_CLASSES[useFieldSize()]
  const selectId = useId()
  const stored = node.params[param.id]
  const value = param.options.find((option) => option.value === stored)?.value ?? param.default

  return (
    <li className={cn(ROW_CLASS, sizeClasses.row)}>
      <Label htmlFor={selectId} className={cn(LABEL_CLASS, sizeClasses.label)}>
        {param.label}
      </Label>
      <OptionSelect
        id={selectId}
        value={value}
        options={param.options}
        font="mono"
        onValueChange={(next) => {
          setParam({ nodeId: node.id, paramId: param.id }, next)
        }}
        className={cn('nodrag shrink-0', sizeClasses.select)}
      />
    </li>
  )
}

/**
 * What turning a switch on does, describing the switch. The Inspector shows it under the row, as
 * it shows a port's description; a canvas node has no room for it, so there it is read out to
 * assistive tech and the switch's tooltip shows it.
 */
function ParamDescription({ id, text }: { id: string; text: string }) {
  const isCompact = useFieldSize() === 'compact'
  return (
    <p
      id={id}
      className={
        isCompact ? 'sr-only' : '-mt-1 px-3 pb-2 text-micro text-pretty text-muted-foreground'
      }
    >
      {text}
    </p>
  )
}

/**
 * A switch that shows what it does in a tooltip, on hover and on keyboard focus (focus bubbles
 * up to the wrapper). The wrapper is the trigger so the tooltip's own `data-state` never replaces
 * the switch's, which its checked and unchecked styles read.
 */
function DescribedSwitch({
  description,
  children,
}: {
  description: string
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0">{children}</span>
      </TooltipTrigger>
      {/* Hidden from assistive tech: the switch is already described by the same text. */}
      <TooltipContent side="top" aria-hidden="true" className="max-w-60 text-pretty">
        {description}
      </TooltipContent>
    </Tooltip>
  )
}

function BooleanParamField({ node, param }: ParamFieldProps<BooleanParam>) {
  const { setParam } = useNodeFieldActions()
  const fieldSize = useFieldSize()
  const sizeClasses = SIZE_CLASSES[fieldSize]
  const switchId = useId()
  const descriptionId = useId()
  const stored = node.params[param.id]
  const isChecked = typeof stored === 'boolean' ? stored : param.default
  const { description } = param

  // An on/off setting that applies at once: a switch, with its hit area grown to 24px+.
  const toggle = (
    <Switch
      id={switchId}
      size={sizeClasses.switchSize}
      checked={isChecked}
      aria-describedby={description === undefined ? undefined : descriptionId}
      onCheckedChange={(checked) => {
        setParam({ nodeId: node.id, paramId: param.id }, checked)
      }}
      className={cn('nodrag nokey', sizeClasses.switchInset, SWITCH_OUTLINE_WHEN_OFF)}
    />
  )

  return (
    <li>
      <div className={cn(ROW_CLASS, sizeClasses.row)}>
        <Label htmlFor={switchId} className={cn(LABEL_CLASS, sizeClasses.label)}>
          {param.label}
        </Label>
        {description !== undefined && fieldSize === 'compact' ? (
          <DescribedSwitch description={description}>{toggle}</DescribedSwitch>
        ) : (
          toggle
        )}
      </div>
      {description !== undefined && <ParamDescription id={descriptionId} text={description} />}
    </li>
  )
}

const DEFAULT_NUMBER_STEP = 1

/** The value held within the param's `min` and `max`, when it declares them. */
function clampToBounds(param: NumberParam, value: number): number {
  const atLeastMin = param.min === undefined ? value : Math.max(param.min, value)
  return param.max === undefined ? atLeastMin : Math.min(param.max, atLeastMin)
}

function NumberParamField({ node, param }: ParamFieldProps<NumberParam>) {
  const { setParam } = useNodeFieldActions()
  const sizeClasses = SIZE_CLASSES[useFieldSize()]
  const stored = node.params[param.id]
  const value = typeof stored === 'number' ? stored : param.default
  const step = param.step ?? DEFAULT_NUMBER_STEP

  return (
    <li className={cn(ROW_CLASS, sizeClasses.row)}>
      <NumberField
        label={param.label}
        value={value}
        isDefault={stored === undefined}
        layout="row"
        arrowStep={step}
        isInteger={Number.isInteger(step)}
        onCommit={(next) => {
          const bounded = clampToBounds(param, next)
          if (bounded === value) return
          setParam({ nodeId: node.id, paramId: param.id }, bounded)
        }}
        // A structural param recompiles, so a scrub commits once on release and has no live preview.
        onScrubPreview={noop}
        onScrubPreviewEnd={noop}
      />
    </li>
  )
}

function noop(): void {
  // Nothing to preview.
}

/** One param row: a select for an enum, a switch for a toggle, a numeric field for a number. */
export function ParamField({ node, param }: ParamFieldProps<BodyParam>) {
  switch (param.kind) {
    case 'enum':
      return <EnumParamField node={node} param={param} />
    case 'boolean':
      return <BooleanParamField node={node} param={param} />
    case 'number':
      return <NumberParamField node={node} param={param} />
  }
}

export interface ParamFieldsProps {
  node: GraphNode
  params: readonly BodyParam[]
}

/** A node's structural settings: a compact select per enum, a switch per toggle, a field per number. */
export function ParamFields({ node, params }: ParamFieldsProps) {
  return (
    <ul className="border-b py-1">
      {params.map((param) => (
        <ParamField key={param.id} node={node} param={param} />
      ))}
    </ul>
  )
}
