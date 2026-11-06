import { Fn, Loop, Stack, Var, float, min } from 'three/tsl'
import type { Node } from 'three/webgpu'

/** The most passes a Repeat zone makes, so a runaway count cannot hang the GPU. */
const MAX_ITERATIONS = 1024

/**
 * The loop of a Repeat zone. `captured`, `index` and `state` are vars (`Var`) declared ahead
 * of the loop, in that order: values from outside the zone, the pass number (or null when nothing
 * reads it) and each slot's value. Each of `count` passes (whole, at most 1024) sets `index` and
 * then every slot to its `next` value; all of them are computed before any slot changes, so each
 * reads the previous pass. Returns each slot read after the loop, which every reader shares: the
 * loop is written once, wherever the first of them is built.
 */
export function repeatLoop(
  count: Node<'float'>,
  captured: readonly Node[],
  index: Node | null,
  state: readonly Node[],
  next: readonly Node[],
): Node[] {
  const loop = Loop(min(count, MAX_ITERATIONS), ({ i }) => {
    if (index !== null) index.assign(float(i))
    const computed = next.map((value) => Var(value))
    state.forEach((value, slot) => value.assign(computed[slot] ?? value))
  })
  const declared = [...captured, ...(index === null ? [] : [index]), ...state, loop]
  return state.map((value) =>
    Fn(() => {
      declared.forEach((node) => Stack(node))
      return value
    })(),
  )
}
