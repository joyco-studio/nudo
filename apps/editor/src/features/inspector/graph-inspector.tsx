import { MASTER_NODE_ID } from '@nudo-tsl/core'
import type { Graph, ResolvedTypes } from '@nudo-tsl/core'

import { groupInputs } from '@/features/canvas/node-port-layout'
import { ParamField, bodyParams } from '@/features/canvas/param-field'
import { useNodeRegistry } from '@/i18n/use-node-registry'
import { useT } from '@/i18n/use-t'

import { INSPECTOR_ROW_CLASS, InspectorInputRows } from './inspector-input-row'
import { InspectorHeader, InspectorSection } from './inspector-section'

/** The master inputs that are material settings rather than surface values. */
const SETTING_INPUT_IDS: ReadonlySet<string> = new Set(['alphaClip'])

export interface GraphInspectorProps {
  graph: Graph
  types: ResolvedTypes
}

/**
 * Shown while nothing is selected: the material settings the Master Stack holds (the same params
 * its node edits, so both stay in step) and the file's schema version, read only.
 */
export function GraphInspector({ graph, types }: GraphInspectorProps) {
  const master = graph.nodes[MASTER_NODE_ID]
  const registry = useNodeRegistry()
  const t = useT()
  const definition = master === undefined ? undefined : registry.get(master.type)
  if (master === undefined || definition === undefined) return null

  const params = bodyParams(master, definition.params)
  const settingRows = groupInputs(
    master,
    definition.inputs.filter((input) => SETTING_INPUT_IDS.has(input.id)),
  ).flatMap((group) => group.rows)

  return (
    <div>
      <InspectorHeader title={t('inspector.graphSettings')}>
        <p className="text-xs text-pretty text-muted-foreground">{t('inspector.graphHint')}</p>
      </InspectorHeader>
      <InspectorSection title={t('inspector.material')}>
        <ul>
          {params.map((param) => (
            <ParamField key={param.id} node={master} param={param} />
          ))}
          <InspectorInputRows graph={graph} node={master} rows={settingRows} types={types} />
        </ul>
      </InspectorSection>
      <InspectorSection title={t('inspector.file')}>
        <dl>
          <div className={INSPECTOR_ROW_CLASS}>
            <dt className="min-w-0 flex-1 text-xs">{t('inspector.schemaVersion')}</dt>
            <dd className="font-mono text-xs text-muted-foreground tabular-nums">
              {graph.schemaVersion}
            </dd>
          </div>
        </dl>
      </InspectorSection>
    </div>
  )
}
