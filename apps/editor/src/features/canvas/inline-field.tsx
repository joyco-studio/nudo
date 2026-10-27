import { float, texture, vec3 } from '@nudo-tsl/core'
import type {
  DataType,
  GraphNode,
  InputDefinition,
  PortValue,
  VectorPortValue,
} from '@nudo-tsl/core'

import { ColorPicker } from '@/shared/components/color-picker/color-picker'
import type { Rgb } from '@/shared/components/color-picker/color-math'
import { cn } from '@/shared/lib/utils'

import { fallbackLabel } from './fallback-label'
import { useFieldSize } from './field-size'
import type { FieldSize } from './field-size'
import { inlineValue, textureAssetId, valueComponents, withComponent } from './inline-value'
import { useNodeFieldActions } from './node-field-actions'
import { NumberField } from './number-field'
import { PortLabel } from './port-label'
import { TextureField } from './texture-field'

const COMPONENT_LABELS = ['X', 'Y', 'Z', 'W'] as const
const OPTIONAL_HINT = 'Mesh default'
/** Optional inputs whose absence means "off" rather than a mesh value. */
const OPTIONAL_HINTS: Readonly<Record<string, string>> = { alphaClip: 'Off' }

const HINT_TEXT: Readonly<Record<FieldSize, string>> = {
  compact: 'text-micro',
  comfortable: 'text-xs',
}
const SWATCH_SIZE: Readonly<Record<FieldSize, string>> = {
  compact: 'size-6',
  comfortable: 'size-7',
}
/** On a node, vector components indent past the port handle; the Inspector has no handles. */
const VECTOR_ROW: Readonly<Record<FieldSize, string>> = {
  compact: 'pb-1.5 pl-3.5',
  comfortable: 'pb-2',
}

export function MutedHint({ children }: { children: string }) {
  const size = useFieldSize()
  return (
    <span className={cn('shrink-0 font-mono text-muted-foreground', HINT_TEXT[size])}>
      {children}
    </span>
  )
}

interface ColorFieldProps {
  label: string
  value: Extract<VectorPortValue, { type: 'vec3' }>
  onCommit: (value: PortValue) => void
  onPreview: (value: PortValue) => void
  onPreviewEnd: () => void
}

const isSameRgb = (a: Rgb, b: Rgb): boolean => a.every((channel, index) => channel === b[index])

/**
 * The custom color picker. Every edit reaches the material live through the preview channel; the
 * picker commits once when it closes, so one pick is one undo step.
 */
function ColorField({ label, value, onCommit, onPreview, onPreviewEnd }: ColorFieldProps) {
  const size = useFieldSize()
  return (
    <>
      <PortLabel label={label} />
      <ColorPicker
        label={label}
        value={value.value}
        className={cn('nodrag', SWATCH_SIZE[size])}
        onPreview={(next) => {
          onPreview(vec3(...next))
        }}
        onCommit={(next) => {
          if (!isSameRgb(next, value.value)) onCommit(vec3(...next))
          onPreviewEnd()
        }}
        onCancel={onPreviewEnd}
      />
    </>
  )
}

interface VectorFieldProps {
  label: string
  value: VectorPortValue
  isDefault: boolean
  onCommit: (value: PortValue) => void
  onScrubPreview: (value: PortValue) => void
  onScrubPreviewEnd: () => void
}

/** One number field per component, on their own line under the port label. */
function VectorField({
  label,
  value,
  isDefault,
  onCommit,
  onScrubPreview,
  onScrubPreviewEnd,
}: VectorFieldProps) {
  const size = useFieldSize()
  return (
    <>
      <PortLabel label={label} />
      <div className={cn('flex basis-full gap-1', VECTOR_ROW[size])}>
        {valueComponents(value).map((component, index) => {
          const componentLabel = COMPONENT_LABELS[index] ?? String(index)
          return (
            <NumberField
              key={componentLabel}
              label={componentLabel}
              accessibleName={`${label} ${componentLabel}`}
              value={component}
              isDefault={isDefault}
              layout="component"
              onCommit={(next) => {
                onCommit(withComponent(value, index, next))
              }}
              onScrubPreview={(next) => {
                onScrubPreview(withComponent(value, index, next))
              }}
              onScrubPreviewEnd={onScrubPreviewEnd}
            />
          )
        })}
      </div>
    </>
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
  if (input.optional === true) {
    return (
      <>
        <PortLabel label={input.label} />
        <MutedHint>{OPTIONAL_HINTS[input.id] ?? OPTIONAL_HINT}</MutedHint>
      </>
    )
  }

  if (input.fallback !== undefined) {
    return (
      <>
        <PortLabel label={input.label} />
        <MutedHint>{fallbackLabel(input.fallback)}</MutedHint>
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
