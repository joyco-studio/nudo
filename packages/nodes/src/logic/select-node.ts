import { concrete, defineNode, float, generic } from '@nudo-tsl/core'
import type { CompareOp } from '@nudo-tsl/core'

const TYPE_GROUP = 'T'
const DEFAULT_COMPARE_OP: CompareOp = 'lt'

const COMPARE_OPTIONS: readonly { readonly value: CompareOp; readonly label: string }[] = [
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'eq', label: '=' },
]

const resolveCompareOp = (param: unknown): CompareOp =>
  COMPARE_OPTIONS.find((option) => option.value === param)?.value ?? DEFAULT_COMPARE_OP

export const selectNode = defineNode({
  type: 'logic/select',
  category: 'math',
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
      resolveCompareOp(params.op),
      inputs.a,
      inputs.b,
      inputs.whenTrue,
      inputs.whenFalse,
    ),
  }),
})
