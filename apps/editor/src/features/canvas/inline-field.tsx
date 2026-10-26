import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { float, vec3 } from '@nudo-tsl/core'
import type {
  DataType,
  GraphNode,
  InputDefinition,
  PortValue,
  VectorPortValue,
} from '@nudo-tsl/core'

import { linearToSrgbHex, srgbHexToLinear } from './color-space'
import { useGraphCanvasActions } from './graph-canvas-actions'
import { inlineValue, valueComponents, withComponent } from './inline-value'
import { NumberField } from './number-field'

const COMPONENT_LABELS = ['X', 'Y', 'Z', 'W'] as const
const OPTIONAL_HINT = 'Mesh default'
const TEXTURE_HINT = 'No texture'

interface PortLabelProps {
  label: string
}

export function PortLabel({ label }: PortLabelProps) {
  return <span className="min-w-0 flex-1 truncate text-xs">{label}</span>
}

function MutedHint({ children }: { children: string }) {
  return <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{children}</span>
}

interface ColorFieldProps {
  label: string
  value: Extract<VectorPortValue, { type: 'vec3' }>
  onCommit: (value: PortValue) => void
}

/**
 * Native color picker. It speaks sRGB hex; the stored vec3 is linear. The swatch previews while
 * the picker is open and commits once, on the native `change` event, so one pick is one undo step.
 */
function ColorField({ label, value, onCommit }: ColorFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewHex, setPreviewHex] = useState<string | null>(null)
  const hex = previewHex ?? linearToSrgbHex(value.value)

  const commitPickedColor = useEffectEvent((pickedHex: string) => {
    setPreviewHex(null)
    const linear = srgbHexToLinear(pickedHex)
    if (linear === null || pickedHex === linearToSrgbHex(value.value)) return
    onCommit(vec3(...linear))
  })

  useEffect(() => {
    const input = inputRef.current
    if (input === null) return
    const onChange = (): void => {
      commitPickedColor(input.value)
    }
    input.addEventListener('change', onChange)
    return () => {
      input.removeEventListener('change', onChange)
    }
  }, [])

  return (
    <>
      <PortLabel label={label} />
      <span aria-hidden="true" className="font-mono text-[11px] text-muted-foreground uppercase">
        {hex}
      </span>
      <input
        ref={inputRef}
        type="color"
        aria-label={label}
        value={hex}
        onChange={(event) => {
          setPreviewHex(event.target.value)
        }}
        // A picker closed without a `change` event must not leave the preview stuck.
        onBlur={() => {
          setPreviewHex(null)
        }}
        className="nodrag size-6 shrink-0 cursor-pointer border border-border bg-transparent p-0 [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
      />
    </>
  )
}

interface VectorFieldProps {
  label: string
  value: VectorPortValue
  isDefault: boolean
  onCommit: (value: PortValue) => void
}

/** One number field per component, on their own line under the port label. */
function VectorField({ label, value, isDefault, onCommit }: VectorFieldProps) {
  return (
    <>
      <PortLabel label={label} />
      <div className="flex basis-full gap-1 pb-1.5 pl-3.5">
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
  const { setInputValue } = useGraphCanvasActions()
  if (input.optional === true) {
    return (
      <>
        <PortLabel label={input.label} />
        <MutedHint>{OPTIONAL_HINT}</MutedHint>
      </>
    )
  }

  const value = inlineValue(node, input, dataType)
  if (value === null) {
    return (
      <>
        <PortLabel label={input.label} />
        <MutedHint>{TEXTURE_HINT}</MutedHint>
      </>
    )
  }

  const isDefault = node.inputValues[input.id] === undefined
  const commit = (next: PortValue): void => {
    setInputValue({ nodeId: node.id, portId: input.id }, next)
  }

  if (input.widget === 'color' && value.type === 'vec3') {
    return <ColorField label={input.label} value={value} onCommit={commit} />
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
      />
    )
  }
  return <VectorField label={input.label} value={value} isDefault={isDefault} onCommit={commit} />
}
