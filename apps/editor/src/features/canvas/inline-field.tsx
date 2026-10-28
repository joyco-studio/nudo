import { float, texture } from '@nudo-tsl/core'
import type { DataType, GraphNode, InputDefinition, PortValue } from '@nudo-tsl/core'

import type { MessageKey } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'
import { cn } from '@/shared/lib/utils'

import { ColorField } from './color-field'
import { fallbackLabel } from './fallback-label'
import { useFieldSize } from './field-size'
import type { FieldSize } from './field-size'
import { inlineValue, textureAssetId } from './inline-value'
import { useNodeFieldActions } from './node-field-actions'
import { NumberField } from './number-field'
import { PortLabel } from './port-label'
import { TextureField } from './texture-field'
import { VectorField } from './vector-field'

const OPTIONAL_HINT: MessageKey = 'node.meshDefault'
/** Optional inputs whose absence means "off" rather than a mesh value. */
const OPTIONAL_HINTS: Readonly<Record<string, MessageKey>> = { alphaClip: 'node.off' }

const HINT_TEXT: Readonly<Record<FieldSize, string>> = {
  compact: 'text-micro',
  comfortable: 'text-xs',
}
/** A short muted note in place of a field ("Mesh default", "Off"). */
export function MutedHint({ children }: { children: string }) {
  const size = useFieldSize()
  return (
    <span className={cn('shrink-0 font-mono text-muted-foreground', HINT_TEXT[size])}>
      {children}
    </span>
  )
}

export interface InlineFieldProps {
  node: GraphNode
  input: InputDefinition<string>
  dataType: DataType
}

/** The label and editor of an unconnected input, picked by widget and resolved type. */
export function InlineField({ node, input, dataType }: InlineFieldProps) {
  const { setInputValue, previewInputValue, endInputPreview } = useNodeFieldActions()
  const t = useT()
  if (input.optional === true) {
    return (
      <>
        <PortLabel label={input.label} />
        <MutedHint>{t(OPTIONAL_HINTS[input.id] ?? OPTIONAL_HINT)}</MutedHint>
      </>
    )
  }

  if (input.fallback !== undefined) {
    return (
      <>
        <PortLabel label={input.label} />
        <MutedHint>{t(fallbackLabel(input.fallback))}</MutedHint>
      </>
    )
  }

  const ref = { nodeId: node.id, portId: input.id }
  const commit = (next: PortValue): void => {
    setInputValue(ref, next)
  }

  const value = inlineValue(node, input, dataType)
  if (value === null) {
    return (
      <TextureField
        label={input.label}
        assetId={textureAssetId(node, input)}
        onChange={(assetId) => {
          commit(texture(assetId))
        }}
      />
    )
  }

  const isDefault = node.inputValues[input.id] === undefined
  const preview = (next: PortValue): void => {
    previewInputValue(ref, next)
  }

  if (input.widget === 'color' && value.type === 'vec3') {
    return (
      <ColorField
        label={input.label}
        value={value}
        onCommit={commit}
        onPreview={preview}
        onPreviewEnd={endInputPreview}
      />
    )
  }
  if (value.type === 'float') {
    return (
      <NumberField
        label={input.label}
        value={value.value}
        isDefault={isDefault}
        layout="row"
        onCommit={(next) => {
          commit(float(next))
        }}
        onScrubPreview={(next) => {
          preview(float(next))
        }}
        onScrubPreviewEnd={endInputPreview}
      />
    )
  }
  return (
    <VectorField
      label={input.label}
      value={value}
      isDefault={isDefault}
      onCommit={commit}
      onScrubPreview={preview}
      onScrubPreviewEnd={endInputPreview}
    />
  )
}
