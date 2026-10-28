import { componentCount } from '@nudo-tsl/core'
import type { Conversion } from '@nudo-tsl/core'

import { plural } from '@/i18n/translate'
import type { Translate } from '@/i18n/translate'

const COMPONENTS = ['x', 'y', 'z', 'w'] as const
type Component = (typeof COMPONENTS)[number]
/** What `convertValue` and `applyConversion` put in a component a narrower vector lacked. */
const PAD_VALUES: Readonly<Record<Component, number>> = { x: 0, y: 0, z: 0, w: 1 }

/** "x", "x and y", "x, y and z", in the UI language. */
function listOf(items: readonly string[], t: Translate): string {
  const last = items.at(-1)
  if (items.length <= 1 || last === undefined) return items.join('')
  return t('list.and', { items: items.slice(0, -1).join(', '), last })
}

/** Component names as the sentence writes them (Spanish quotes them: «y» reads apart from "y"). */
function componentsBetween(start: number, end: number, t: Translate): readonly string[] {
  return COMPONENTS.slice(start, end).map((name) => t('conversion.component', { name }))
}

function keptPhrase(count: number, t: Translate): string {
  if (count === 1)
    return t('conversion.keptOnly', { component: t('conversion.component', { name: 'x' }) })
  return t('conversion.kept', { components: listOf(componentsBetween(0, count, t), t) })
}

function droppedPhrase(from: number, to: number, t: Translate): string {
  const dropped = componentsBetween(to, from, t)
  const key = plural(dropped.length, {
    one: 'conversion.dropped.one',
    other: 'conversion.dropped.other',
  })
  return t(key, { components: listOf(dropped, t) })
}

/** "z is set to 0", "z is set to 0 and w to 1", "w is set to 1". */
function paddedPhrase(from: number, to: number, t: Translate): string {
  const assignments = COMPONENTS.slice(from, to).map((component, index) => {
    const values = {
      component: t('conversion.component', { name: component }),
      value: PAD_VALUES[component],
    }
    return index === 0 ? t('conversion.setFirst', values) : t('conversion.setNext', values)
  })
  return listOf(assignments, t)
}

function effectOf(conversion: Conversion, t: Translate): string {
  const from = componentCount(conversion.from)
  const to = componentCount(conversion.to)
  switch (conversion.kind) {
    case 'splat':
      return t('conversion.splat', { components: listOf(componentsBetween(0, to, t), t) })
    case 'truncate':
      return `${keptPhrase(to, t)}, ${droppedPhrase(from, to, t)}`
    case 'pad':
      return `${keptPhrase(from, t)}, ${paddedPhrase(from, to, t)}`
  }
}

/**
 * What an implicit conversion does to the value, in words of the UI language: the same splat,
 * truncation or padding the runtime applies (`convertValue`, `applyConversion`).
 */
export function describeConversion(conversion: Conversion, t: Translate): string {
  return t('conversion.sentence', {
    from: conversion.from,
    to: conversion.to,
    effect: effectOf(conversion, t),
  })
}
