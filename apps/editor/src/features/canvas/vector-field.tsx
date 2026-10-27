import type { PortValue, VectorPortValue } from '@nudo-tsl/core'

import { cn } from '@/shared/lib/utils'

import { valueComponents, withComponent } from './inline-value'
import { NumberField } from './number-field'
import { PortLabel } from './port-label'

const COMPONENT_LABELS = ['X', 'Y', 'Z', 'W'] as const

export interface VectorFieldProps {
  label: string
  value: VectorPortValue
  isDefault: boolean
  onCommit: (value: PortValue) => void
  onScrubPreview: (value: PortValue) => void
  onScrubPreviewEnd: () => void
  /** Extra classes for the line of component fields (its indent under the label). */
  componentsClassName?: string
}

/**
 * The label, then one number field per component on their own line under it. Used by node inputs
 * and Blackboard properties alike.
 */
export function VectorField({
  label,
  value,
  isDefault,
  onCommit,
  onScrubPreview,
  onScrubPreviewEnd,
  componentsClassName,
}: VectorFieldProps) {
  return (
    <>
      <PortLabel label={label} />
      <div className={cn('flex basis-full gap-1 pb-1.5 pl-3.5', componentsClassName)}>
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
