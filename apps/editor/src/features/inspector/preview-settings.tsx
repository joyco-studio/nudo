import { UNIVERSAL_PARAMS } from '@nudo-tsl/core'
import type { AnyNodeDefinition, GraphNode } from '@nudo-tsl/core'

import { ParamField } from '@/features/canvas/param-field'
import type { BodyParam } from '@/features/canvas/param-field'
import {
  PREVIEW_MODE_PARAM,
  SHOW_PREVIEW_PARAM,
  hasNodePreview,
} from '@/features/node-previews/preview-graph'

import { InspectorSection } from './inspector-section'

const PREVIEW_TITLE = 'Preview'

/** Row labels inside the Preview section, where the section title already says "preview". */
const ROW_LABELS: Readonly<Record<string, string>> = {
  [SHOW_PREVIEW_PARAM]: 'Show',
  [PREVIEW_MODE_PARAM]: 'Mode',
}

const isPreviewParam = (param: (typeof UNIVERSAL_PARAMS)[number]): param is BodyParam =>
  (param.kind === 'boolean' || param.kind === 'enum') && param.id in ROW_LABELS

/** The universal preview params (on/off, Auto/2D/3D), with the labels this section uses. */
const PREVIEW_PARAMS: readonly BodyParam[] = UNIVERSAL_PARAMS.filter(isPreviewParam).map(
  (param) => ({ ...param, label: ROW_LABELS[param.id] ?? param.label }),
)

interface PreviewSettingsProps {
  node: GraphNode
  definition: AnyNodeDefinition
}

/**
 * The node's preview: shown or hidden (the same switch as the eye in its header) and whether it
 * draws on a quad, a sphere or picks one by itself. Nodes without a preview have no section.
 */
export function PreviewSettings({ node, definition }: PreviewSettingsProps) {
  if (!hasNodePreview(node, definition)) return null

  return (
    <InspectorSection title={PREVIEW_TITLE}>
      <ul>
        {PREVIEW_PARAMS.map((param) => (
          <ParamField key={param.id} node={node} param={param} />
        ))}
      </ul>
    </InspectorSection>
  )
}
