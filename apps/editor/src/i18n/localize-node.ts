import { createNodeRegistry } from '@nudo-tsl/core'
import type { AnyNodeDefinition, NodeRegistry, ParamDefinition } from '@nudo-tsl/core'

import type { NodeTexts, NodeTranslations, ParamTexts } from './node-texts'

interface Labeled {
  readonly id: string
  readonly label: string
}

function withLabels<P extends Labeled>(
  ports: readonly P[],
  labels: Readonly<Record<string, string>> | undefined,
): P[] {
  return ports.map((port) => ({ ...port, label: labels?.[port.id] ?? port.label }))
}

/** A param in another language: its name and its options' names, English where left out. */
export function localizeParam(
  param: ParamDefinition,
  texts: ParamTexts | undefined,
): ParamDefinition {
  if (texts === undefined) return param
  if (param.kind !== 'enum') return { ...param, label: texts.label }
  return {
    ...param,
    label: texts.label,
    options: param.options.map((option) => ({
      ...option,
      label: texts.options?.[option.value] ?? option.label,
    })),
  }
}

/**
 * The definition with its texts in another language. Everything else (type, ports, build) stays,
 * and the English label and keywords stay searchable after the translated ones.
 */
export function localizeDefinition(
  definition: AnyNodeDefinition,
  texts: NodeTexts | undefined,
): AnyNodeDefinition {
  if (texts === undefined) return definition
  const params = definition.params?.map((param) => localizeParam(param, texts.params?.[param.id]))
  return {
    ...definition,
    label: texts.label,
    description: texts.description,
    keywords: [...texts.keywords, definition.label, ...definition.keywords],
    inputs: withLabels(definition.inputs, texts.inputs),
    outputs: withLabels(definition.outputs, texts.outputs),
    ...(params !== undefined && { params }),
  }
}

/**
 * A registry holding every definition of `source` in another language, for what the UI shows and
 * searches. Compiling keeps using the source registry: a language switch never rebuilds a shader.
 */
export function localizeRegistry(
  source: NodeRegistry,
  translations: NodeTranslations,
): NodeRegistry {
  const localized = createNodeRegistry()
  for (const definition of source.list()) {
    localized.register(localizeDefinition(definition, translations[definition.type]))
  }
  return localized
}
