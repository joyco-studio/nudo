import { useId } from 'react'
import { UNIVERSAL_PARAM_IDS } from '@nudo-tsl/core'
import type { GraphNode, ParamDefinition } from '@nudo-tsl/core'

import { cn } from '@/shared/lib/utils'
import { OptionSelect } from '@/shared/components/option-select'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'

import { useFieldSize } from './field-size'
import type { FieldSize } from './field-size'
import { useNodeFieldActions } from './node-field-actions'
import type { BooleanParam, EnumParam } from './param-kinds'

/** The params a node body edits. String and number params are only ever hidden for now. */
export type BodyParam = EnumParam | BooleanParam

function isBodyParam(param: ParamDefinition): param is BodyParam {
  return (param.kind === 'enum' || param.kind === 'boolean') && !UNIVERSAL_PARAM_IDS.has(param.id)
}

/** The params a node shows in its body, in definition order. */
export function bodyParams(params: readonly ParamDefinition[] | undefined): readonly BodyParam[] {
  return (params ?? []).filter(isBodyParam)
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

function BooleanParamField({ node, param }: ParamFieldProps<BooleanParam>) {
  const { setParam } = useNodeFieldActions()
  const sizeClasses = SIZE_CLASSES[useFieldSize()]
  const switchId = useId()
  const stored = node.params[param.id]
  const isChecked = typeof stored === 'boolean' ? stored : param.default

  return (
    <li className={cn(ROW_CLASS, sizeClasses.row)}>
      <Label htmlFor={switchId} className={cn(LABEL_CLASS, sizeClasses.label)}>
        {param.label}
      </Label>
      {/* An on/off setting that applies at once: a switch, with its hit area grown to 24px+. */}
      <Switch
        id={switchId}
        size={sizeClasses.switchSize}
        checked={isChecked}
        onCheckedChange={(checked) => {
          setParam({ nodeId: node.id, paramId: param.id }, checked)
        }}
        className={cn('nodrag nokey', sizeClasses.switchInset, SWITCH_OUTLINE_WHEN_OFF)}
      />
    </li>
  )
}

/** One param row: a select for an enum, a switch for a toggle. */
export function ParamField({ node, param }: ParamFieldProps<BodyParam>) {
  return param.kind === 'enum' ? (
    <EnumParamField node={node} param={param} />
  ) : (
    <BooleanParamField node={node} param={param} />
  )
}

export interface ParamFieldsProps {
  node: GraphNode
  params: readonly BodyParam[]
}

/** A node's structural settings: a compact select per enum, a switch per toggle. */
export function ParamFields({ node, params }: ParamFieldsProps) {
  return (
    <ul className="border-b py-1">
      {params.map((param) => (
        <ParamField key={param.id} node={node} param={param} />
      ))}
    </ul>
  )
}
