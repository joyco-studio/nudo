import { MASTER_NODE_ID, serializeGraph, setParam } from '@nudo-tsl/core'
import { createDefaultRegistry } from '@nudo-tsl/nodes'

import { createCatalogGraph } from '../../../../packages/codegen/src/fixtures/catalog-graph'

const MASTER_TYPE = 'master/stack'
const LIGHTING_PARAM_ID = 'lighting'

/**
 * The lighting modes the master offers, read from its definition so a mode added to the catalog
 * is covered without editing the specs.
 */
export function masterLightingOptions(): readonly string[] {
  const lighting = createDefaultRegistry()
    .get(MASTER_TYPE)
    ?.params?.find((param) => param.id === LIGHTING_PARAM_ID)
  if (lighting?.kind !== 'enum') throw new Error('The master has no enum param named lighting')
  return lighting.options.map((option) => option.value)
}

/**
 * A schema-2 autosave document holding every catalog node wired to the master, with the master's
 * `lighting` param set to `lighting` and each boolean param in `switchedOn` turned on.
 */
export function catalogDocument(lighting: string, switchedOn: readonly string[] = []): string {
  const registry = createDefaultRegistry()
  const settings: readonly (readonly [string, string | boolean])[] = [
    [LIGHTING_PARAM_ID, lighting],
    ...switchedOn.map((paramId): readonly [string, boolean] => [paramId, true]),
  ]
  const graph = settings.reduce((current, [paramId, value]) => {
    const result = setParam(current, registry, { nodeId: MASTER_NODE_ID, paramId }, value)
    if (!result.ok)
      throw new Error(`Cannot set ${paramId} to ${String(value)}: ${result.error.code}`)
    return result.value
  }, createCatalogGraph(registry))
  return serializeGraph(graph)
}
