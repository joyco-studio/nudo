import { useId } from 'react'
import { UNIVERSAL_PARAM_IDS } from '@nudo-tsl/core'
import type { GraphNode, ParamDefinition } from '@nudo-tsl/core'

import { cn } from '@/shared/lib/utils'
import { OptionSelect } from '@/shared/components/option-select'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'

import { useGraphCanvasActions } from './graph-canvas-actions'
import type { BooleanParam, EnumParam } from './param-kinds'

/** The params a node body edits. String and number params are only ever hidden for now. */
type BodyParam = EnumParam | BooleanParam

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

const ROW_CLASS = 'flex h-7 items-center gap-2 pr-2 pl-3'
const LABEL_CLASS = 'block min-w-0 flex-1 truncate text-xs leading-7 font-normal'

interface ParamFieldProps<P extends BodyParam> {
  node: GraphNode
  param: P
}

function EnumParamField({ node, param }: ParamFieldProps<EnumParam>) {
  const { setParam } = useGraphCanvasActions()
  const selectId = useId()
  const stored = node.params[param.id]
  const value = param.options.find((option) => option.value === stored)?.value ?? param.default

  return (
    <li className={ROW_CLASS}>
      <Label htmlFor={selectId} className={LABEL_CLASS}>
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
        className="nodrag w-28 shrink-0"
      />
    </li>
  )
}

function BooleanParamField({ node, param }: ParamFieldProps<BooleanParam>) {
  const { setParam } = useGraphCanvasActions()
  const switchId = useId()
  const stored = node.params[param.id]
  const isChecked = typeof stored === 'boolean' ? stored : param.default

  return (
    <li className={ROW_CLASS}>
      <Label htmlFor={switchId} className={LABEL_CLASS}>
        {param.label}
      </Label>
      {/* An on/off setting that applies at once: a switch, with its hit area grown to 24px+. */}
      <Switch
        id={switchId}
        size="sm"
        checked={isChecked}
        onCheckedChange={(checked) => {
          setParam({ nodeId: node.id, paramId: param.id }, checked)
        }}
        className={cn('nodrag nokey mr-1', SWITCH_OUTLINE_WHEN_OFF)}
      />
    </li>
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
      {params.map((param) =>
        param.kind === 'enum' ? (
          <EnumParamField key={param.id} node={node} param={param} />
        ) : (
          <BooleanParamField key={param.id} node={node} param={param} />
        ),
      )}
    </ul>
  )
}
