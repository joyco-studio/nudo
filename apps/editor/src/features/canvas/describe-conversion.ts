import { componentCount } from '@nudo-tsl/core'
import type { Conversion } from '@nudo-tsl/core'

const COMPONENTS = ['x', 'y', 'z', 'w'] as const
/** What `convertValue` and `applyConversion` put in a component a narrower vector lacked. */
const PAD_VALUES: Readonly<Record<(typeof COMPONENTS)[number], number>> = { x: 0, y: 0, z: 0, w: 1 }

/** "x", "x and y", "x, y and z". */
function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`
}

function componentsBetween(start: number, end: number): readonly (typeof COMPONENTS)[number][] {
  return COMPONENTS.slice(start, end)
}

function keptPhrase(count: number): string {
  return count === 1 ? 'only x is kept' : `${listOf(componentsBetween(0, count))} are kept`
}

function droppedPhrase(from: number, to: number): string {
  const dropped = componentsBetween(to, from)
  return `${listOf(dropped)} ${dropped.length === 1 ? 'is' : 'are'} dropped`
}

/** "z is set to 0", "z is set to 0 and w to 1", "w is set to 1". */
function paddedPhrase(from: number, to: number): string {
  const assignments = componentsBetween(from, to).map((component, index) => {
    const value = String(PAD_VALUES[component])
    return index === 0 ? `${component} is set to ${value}` : `${component} to ${value}`
  })
  return listOf(assignments)
}

function effectOf(conversion: Conversion): string {
  const from = componentCount(conversion.from)
  const to = componentCount(conversion.to)
  switch (conversion.kind) {
    case 'splat':
      return `the value is copied into ${listOf(componentsBetween(0, to))}`
    case 'truncate':
      return `${keptPhrase(to)}, ${droppedPhrase(from, to)}`
    case 'pad':
      return `${keptPhrase(from)}, ${paddedPhrase(from, to)}`
  }
}

/**
 * What an implicit conversion does to the value, in words: the same splat, truncation or padding
 * the runtime applies (`convertValue`, `applyConversion`).
 */
export function describeConversion(conversion: Conversion): string {
  return `Converted from ${conversion.from} to ${conversion.to}: ${effectOf(conversion)}.`
}
