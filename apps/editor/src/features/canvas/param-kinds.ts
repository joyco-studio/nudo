import type { ParamDefinition } from '@nudo-tsl/core'

export type EnumParam = Extract<ParamDefinition, { kind: 'enum' }>
export type BooleanParam = Extract<ParamDefinition, { kind: 'boolean' }>
export type NumberParam = Extract<ParamDefinition, { kind: 'number' }>

export function isEnumParam(param: ParamDefinition | undefined): param is EnumParam {
  return param?.kind === 'enum'
}
