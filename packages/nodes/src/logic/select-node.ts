import { concrete, defineNode, float, generic } from '@nudo-tsl/core'
import type { CompareOp } from '@nudo-tsl/core'
import type { EnumOption } from '../shared/resolve-enum-param'
import { resolveEnumParam } from '../shared/resolve-enum-param'

const TYPE_GROUP = 'T'
const DEFAULT_COMPARE_OP: CompareOp = 'lt'

const COMPARE_OPTIONS: readonly EnumOption<CompareOp>[] = [
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'eq', label: '=' },
]

export const selectNode = defineNode({
  type: 'logic/select',
  category: 'logic',
  label: 'Select',
  description: 'Picks one of two values depending on how A compares with B.',
  keywords: ['select', 'if', 'branch', 'compare', 'condition', 'switch'],
  inputs: [
    { id: 'a', label: 'A', type: concrete('float'), default: float(0) },
    { id: 'b', label: 'B', type: concrete('float'), default: float(0) },
    { id: 'whenTrue', label: 'When True', type: generic(TYPE_GROUP), default: float(1) },
    { id: 'whenFalse', label: 'When False', type: generic(TYPE_GROUP), default: float(0) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic(TYPE_GROUP) }],
  params: [
    {
      id: 'op',
      label: 'Compare',
      kind: 'enum',
      options: COMPARE_OPTIONS,
      default: DEFAULT_COMPARE_OP,
    },
  ],
  build: ({ tsl, inputs, params }) => ({
    out: tsl.select(
      resolveEnumParam(COMPARE_OPTIONS, params.op, DEFAULT_COMPARE_OP),
      inputs.a,
      inputs.b,
      inputs.whenTrue,
      inputs.whenFalse,
    ),
  }),
})
