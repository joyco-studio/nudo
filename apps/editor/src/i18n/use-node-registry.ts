import type { NodeRegistry, ParamDefinition } from '@nudo-tsl/core'

import { registry } from '@/store/registry'

import { localizeParam, localizeRegistry } from './localize-node'
import type { Locale } from './locale'
import { NODES_ES, UNIVERSAL_PARAMS_ES } from './nodes.es'
import { useCurrentLocale } from './use-t'

/** English is the registry itself; the Spanish one is built once, on first use. */
let spanishRegistry: NodeRegistry | null = null

export function nodeRegistryFor(locale: Locale): NodeRegistry {
  if (locale === 'en') return registry
  spanishRegistry ??= localizeRegistry(registry, NODES_ES)
  return spanishRegistry
}

/**
 * The node registry in the UI language, for every label, description and search the UI shows.
 * Graph edits and compiling use the store's registry.
 */
export function useNodeRegistry(): NodeRegistry {
  return nodeRegistryFor(useCurrentLocale())
}

/** A universal param (collapsed, preview mode) in the UI language. */
export function useUniversalParam(param: ParamDefinition | undefined): ParamDefinition | undefined {
  const locale = useCurrentLocale()
  if (param === undefined || locale === 'en') return param
  return localizeParam(param, UNIVERSAL_PARAMS_ES[param.id])
}
