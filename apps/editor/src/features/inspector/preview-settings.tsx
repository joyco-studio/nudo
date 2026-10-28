import { UNIVERSAL_PARAMS } from '@nudo-tsl/core'
import type { AnyNodeDefinition, GraphNode, ParamDefinition } from '@nudo-tsl/core'

import { ParamField } from '@/features/canvas/param-field'
import type { BodyParam } from '@/features/canvas/param-field'
import {
  PREVIEW_MODE_PARAM,
  SHOW_PREVIEW_PARAM,
  hasNodePreview,
} from '@/features/node-previews/preview-graph'
import { useUniversalParam } from '@/i18n/use-node-registry'
import type { MessageKey } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'

import { InspectorSection } from './inspector-section'

/** Row labels inside the Preview section, where the section title already says "preview". */
const ROW_LABELS: Readonly<Record<string, MessageKey>> = {
  [SHOW_PREVIEW_PARAM]: 'inspector.preview.show',
  [PREVIEW_MODE_PARAM]: 'inspector.preview.mode',
}

const PREVIEW_PARAM_IDS = [SHOW_PREVIEW_PARAM, PREVIEW_MODE_PARAM] as const

const isBodyParam = (param: ParamDefinition | undefined): param is BodyParam =>
  param?.kind === 'boolean' || param?.kind === 'enum'

const universalParam = (id: string): ParamDefinition | undefined =>
  UNIVERSAL_PARAMS.find((param) => param.id === id)

interface PreviewParamRowProps {
  node: GraphNode
  paramId: (typeof PREVIEW_PARAM_IDS)[number]
}

/** One universal preview param, in the UI language, labelled for this section. */
function PreviewParamRow({ node, paramId }: PreviewParamRowProps) {
  const t = useT()
  const param = useUniversalParam(universalParam(paramId))
  const labelKey = ROW_LABELS[paramId]
  if (!isBodyParam(param) || labelKey === undefined) return null
  return <ParamField node={node} param={{ ...param, label: t(labelKey) }} />
}

interface PreviewSettingsProps {
  node: GraphNode
  definition: AnyNodeDefinition
}

/**
 * The node's preview: shown or hidden (the same switch as the eye in its header) and whether it
 * draws on a quad, a sphere or picks one by itself. Nodes without a preview have no section.
 */
export function PreviewSettings({ node, definition }: PreviewSettingsProps) {
  const t = useT()
  if (!hasNodePreview(node, definition)) return null

  return (
    <InspectorSection title={t('inspector.preview')}>
      <ul>
        {PREVIEW_PARAM_IDS.map((paramId) => (
          <PreviewParamRow key={paramId} node={node} paramId={paramId} />
        ))}
      </ul>
    </InspectorSection>
  )
}
