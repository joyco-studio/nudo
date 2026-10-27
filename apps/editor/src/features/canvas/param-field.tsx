import { useId } from 'react'
import { UNIVERSAL_PARAM_IDS } from '@nudo-tsl/core'
import type { GraphNode, ParamDefinition } from '@nudo-tsl/core'

import { NativeSelect } from '@/shared/components/native-select'

import { useGraphCanvasActions } from './graph-canvas-actions'

type EnumParam = Extract<ParamDefinition, { kind: 'enum' }>
type BooleanParam = Extract<ParamDefinition, { kind: 'boolean' }>
/** The params a node body edits. String and number params are only ever hidden for now. */
type BodyParam = EnumParam | BooleanParam

function isBodyParam(param: ParamDefinition): param is BodyParam {
  return (param.kind === 'enum' || param.kind === 'boolean') && !UNIVERSAL_PARAM_IDS.has(param.id)
}

/** The params a node shows in its body, in definition order. */
export function bodyParams(params: readonly ParamDefinition[] | undefined): readonly BodyParam[] {
  return (params ?? []).filter(isBodyParam)
}

const ROW_CLASS = 'flex h-7 items-center gap-2 pr-2 pl-3'
const LABEL_CLASS = 'min-w-0 flex-1 truncate text-xs'

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
      <label htmlFor={selectId} className={LABEL_CLASS}>
        {param.label}
      </label>
      <NativeSelect
        id={selectId}
        value={value}
        options={param.options}
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
  const checkboxId = useId()
  const stored = node.params[param.id]
  const isChecked = typeof stored === 'boolean' ? stored : param.default

  return (
    <li className={ROW_CLASS}>
      <label htmlFor={checkboxId} className={LABEL_CLASS}>
        {param.label}
      </label>
      {/* A 24px hit area around the small native box (WCAG 2.5.8). */}
      <label className="nodrag flex size-6 shrink-0 cursor-pointer items-center justify-center">
        <input
          id={checkboxId}
          type="checkbox"
          checked={isChecked}
          onChange={(event) => {
            setParam({ nodeId: node.id, paramId: param.id }, event.target.checked)
          }}
          className="size-3.5 cursor-pointer accent-primary"
        />
      </label>
    </li>
  )
}

export interface ParamFieldsProps {
  node: GraphNode
  params: readonly BodyParam[]
}

/** A node's structural settings: a compact select per enum, a checkbox per toggle. */
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
