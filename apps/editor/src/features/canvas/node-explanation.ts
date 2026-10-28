import type { AnyNodeDefinition, DataType, InputDefinition, OutputDefinition } from '@nudo-tsl/core'

import type { Translate } from '@/i18n/translate'

/** The node and output feeding a connected input. */
export interface PortSource {
  readonly nodeTitle: string
  readonly portLabel: string
}

/** Everything a port tooltip says about a port. */
export interface PortExplanation {
  readonly label: string
  readonly dataType: DataType
  /** The definition's description of the port, or null when it has none (a community node). */
  readonly description: string | null
  /** What feeds a connected input; null for outputs and unconnected inputs. */
  readonly source: PortSource | null
}

/** "from Noise · Out", in the UI language. */
export function describePortSource(source: PortSource, t: Translate): string {
  return t('port.source', { node: source.nodeTitle, port: source.portLabel })
}

/**
 * The tooltip as plain sentences for assistive technology: the port's name and type are already
 * in its accessible name, so only the meaning and the source are added. A comma stands in for the
 * middle dot, which screen readers spell out.
 */
export function portAccessibleDescription(
  explanation: PortExplanation,
  t: Translate,
): string | null {
  const { description, source } = explanation
  const parts = [
    description,
    source === null
      ? null
      : t('port.sourceSentence', { node: source.nodeTitle, port: source.portLabel }),
  ].filter((part): part is string => part !== null && part !== '')
  return parts.length === 0 ? null : parts.join(' ')
}

/** What a focused node announces after its name: what it does, then its formula if it has one. */
export function nodeAccessibleDescription(definition: AnyNodeDefinition, t: Translate): string {
  return definition.formula === undefined
    ? definition.description
    : t('node.withFormula', { description: definition.description, formula: definition.formula })
}

/** The tooltip content of an input, with what feeds it when it is connected. */
export function inputExplanation(
  input: InputDefinition<string>,
  dataType: DataType,
  source: PortSource | undefined,
): PortExplanation {
  return {
    label: input.label,
    dataType,
    description: input.description ?? null,
    source: source ?? null,
  }
}

/** The tooltip content of an output. */
export function outputExplanation(
  output: OutputDefinition<string>,
  dataType: DataType,
): PortExplanation {
  return { label: output.label, dataType, description: output.description ?? null, source: null }
}
