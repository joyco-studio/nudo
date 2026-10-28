import { float, texture } from '@nudo-tsl/core'
import type { BlackboardProperty, PortValue } from '@nudo-tsl/core'

import { ColorField } from '@/features/canvas/color-field'
import { NumberField } from '@/features/canvas/number-field'
import { TextureField } from '@/features/canvas/texture-field'
import { VectorField } from '@/features/canvas/vector-field'
import { useT } from '@/i18n/use-t'

export interface PropertyValueFieldProps {
  property: BlackboardProperty
  /** One history entry per committed edit. */
  onCommit: (value: PortValue) => void
  /** A value shown live while a scrub or a color pick is in progress. */
  onPreview: (value: PortValue) => void
  onPreviewEnd: () => void
}

/**
 * The editor of a property's value: the same number, vector, color and texture fields node inputs
 * use. Scrubs and color picks preview live; only the commit reaches the graph.
 */
export function PropertyValueField({
  property,
  onCommit,
  onPreview,
  onPreviewEnd,
}: PropertyValueFieldProps) {
  const { value } = property
  const t = useT()
  if (value.type === 'texture') {
    return (
      <TextureField
        label={property.label}
        visibleLabel={t('property.image')}
        assetId={value.assetId}
        onChange={(assetId) => {
          onCommit(texture(assetId))
        }}
      />
    )
  }
  if (value.type === 'vec3' && property.widget === 'color') {
    return (
      <ColorField
        label={t('property.color')}
        value={value}
        onCommit={onCommit}
        onPreview={onPreview}
        onPreviewEnd={onPreviewEnd}
      />
    )
  }
  if (value.type === 'float') {
    return (
      <NumberField
        label={t('property.value')}
        value={value.value}
        isDefault={false}
        layout="row"
        onCommit={(next) => {
          onCommit(float(next))
        }}
        onScrubPreview={(next) => {
          onPreview(float(next))
        }}
        onScrubPreviewEnd={onPreviewEnd}
      />
    )
  }
  return (
    <VectorField
      label={t('property.value')}
      value={value}
      isDefault={false}
      onCommit={onCommit}
      onScrubPreview={onPreview}
      onScrubPreviewEnd={onPreviewEnd}
      componentsClassName="pb-0 pl-0"
    />
  )
}
