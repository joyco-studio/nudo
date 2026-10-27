import { vec3 } from '@nudo-tsl/core'
import type { PortValue, VectorPortValue } from '@nudo-tsl/core'

import { ColorPicker } from '@/shared/components/color-picker/color-picker'
import type { Rgb } from '@/shared/components/color-picker/color-math'
import { cn } from '@/shared/lib/utils'

import { useFieldSize } from './field-size'
import type { FieldSize } from './field-size'
import { PortLabel } from './port-label'

const SWATCH_SIZE: Readonly<Record<FieldSize, string>> = {
  compact: 'size-6',
  comfortable: 'size-7',
}

export interface ColorFieldProps {
  label: string
  value: Extract<VectorPortValue, { type: 'vec3' }>
  onCommit: (value: PortValue) => void
  onPreview: (value: PortValue) => void
  onPreviewEnd: () => void
}

const isSameRgb = (a: Rgb, b: Rgb): boolean => a.every((channel, index) => channel === b[index])

/**
 * The label and the custom color picker. Every edit reaches the material live through the preview
 * channel; the picker commits once when it closes, so one pick is one undo step. Used by node
 * inputs, the Inspector and Blackboard properties; the swatch follows the field size.
 */
export function ColorField({ label, value, onCommit, onPreview, onPreviewEnd }: ColorFieldProps) {
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
