import {
  REPEAT_INDEX_OUTPUT,
  REPEAT_INPUT_PARAM,
  REPEAT_ITERATIONS_INPUT,
  REPEAT_MAX_ITERATIONS,
  REPEAT_SLOTS,
  concrete,
  defineNode,
  float,
  generic,
} from '@nudo-tsl/core'
import type { InputDefinition, OutputDefinition, RepeatSlot } from '@nudo-tsl/core'

const DEFAULT_ITERATIONS = 8

/** Each slot is its own generic group, shared by its ports on both nodes of the zone. */
const SLOT_GROUPS: Readonly<Record<RepeatSlot, string>> = { a: 'A', b: 'B', c: 'C', d: 'D' }

const slotLabel = (slot: RepeatSlot): string => SLOT_GROUPS[slot]

const slotPorts = <P>(port: (slot: RepeatSlot) => P): readonly P[] => REPEAT_SLOTS.map(port)

const startingValue = (slot: RepeatSlot): InputDefinition<RepeatSlot> => ({
  id: slot,
  label: slotLabel(slot),
  type: generic(SLOT_GROUPS[slot]),
  default: float(0),
  description: `What ${slotLabel(slot)} holds when the first pass starts; its type is the slot's type.`,
})

const currentValue = (slot: RepeatSlot): OutputDefinition<RepeatSlot> => ({
  id: slot,
  label: slotLabel(slot),
  type: generic(SLOT_GROUPS[slot]),
  description: `${slotLabel(slot)} during this pass: its starting value, then what the previous pass handed on.`,
})

const nextValue = (slot: RepeatSlot): InputDefinition<RepeatSlot> => ({
  id: slot,
  label: slotLabel(slot),
  type: generic(SLOT_GROUPS[slot]),
  default: float(0),
  optional: true,
  description: `What ${slotLabel(slot)} becomes for the next pass; unconnected, it stays the same.`,
})

const finalValue = (slot: RepeatSlot): OutputDefinition<RepeatSlot> => ({
  id: slot,
  label: slotLabel(slot),
  type: generic(SLOT_GROUPS[slot]),
  description: `${slotLabel(slot)} after the last pass.`,
})

const ZONE_KEYWORDS = [
  'repeat',
  'loop',
  'for',
  'iterate',
  'zone',
  'raymarch',
  'steps',
  'accumulate',
]

/**
 * The start of a Repeat zone (after Blender's): nodes wired from its outputs to the paired Repeat
 * Output run once per pass, `Iterations` times, each pass reading what the previous one handed on.
 */
export const repeatInputNode = defineNode({
  type: 'logic/repeat-input',
  category: 'logic',
  label: 'Repeat Input',
  description:
    'Starts a loop: the nodes between it and its Repeat Output run once per pass, each pass reading the values the previous one handed on.',
  formula: 'for i < Iterations',
  keywords: ZONE_KEYWORDS,
  repeat: 'input',
  inputs: [
    {
      id: REPEAT_ITERATIONS_INPUT,
      label: 'Iterations',
      type: concrete('float'),
      default: float(DEFAULT_ITERATIONS),
      description: `How many passes the loop makes: a whole number from 0 to ${String(REPEAT_MAX_ITERATIONS)}.`,
    },
    ...slotPorts(startingValue),
  ],
  outputs: [
    {
      id: REPEAT_INDEX_OUTPUT,
      label: 'Index',
      type: concrete('float'),
      description: 'The number of the current pass: 0 on the first, then 1, 2 and so on.',
    },
    ...slotPorts(currentValue),
  ],
  // The compiler builds the zone; this stands in for the first pass in a node preview.
  build: ({ tsl, inputs }) => ({
    index: tsl.construct('float', [0]),
    a: inputs.a,
    b: inputs.b,
    c: inputs.c,
    d: inputs.d,
  }),
})

/** The end of a Repeat zone: what each slot becomes for the next pass, and its value after the last. */
export const repeatOutputNode = defineNode({
  type: 'logic/repeat-output',
  category: 'logic',
  label: 'Repeat Output',
  description:
    'Ends a loop: takes what each value becomes for the next pass, and gives the values after the last pass.',
  formula: 'after the last pass',
  keywords: ZONE_KEYWORDS,
  repeat: 'output',
  inputs: slotPorts(nextValue),
  outputs: slotPorts(finalValue),
  params: [
    {
      id: REPEAT_INPUT_PARAM,
      label: 'Repeat Input',
      kind: 'string',
      default: '',
      hidden: true,
    },
  ],
  build: () => {
    throw new Error('A Repeat Output is built as a loop by the compiler')
  },
})
