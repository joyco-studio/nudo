import type { LucideIcon } from 'lucide-react'
import { Columns2, Maximize2, PictureInPicture2 } from 'lucide-react'

import { Kbd } from '@/shared/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { useEditorStore } from '@/store/editor-store'

import { PREVIEW_LAYOUTS, effectivePreviewLayout } from './panel-state'
import type { PreviewLayout } from './panel-state'

interface LayoutOption {
  readonly label: string
  readonly hint: string
  readonly icon: LucideIcon
}

const LAYOUT_OPTIONS: Readonly<Record<PreviewLayout, LayoutOption>> = {
  docked: { label: 'Docked', hint: 'Float the preview over the canvas', icon: PictureInPicture2 },
  split: { label: 'Split', hint: 'Show the canvas and the preview side by side', icon: Columns2 },
  full: { label: 'Full', hint: 'Fill the workspace with the preview', icon: Maximize2 },
}

function isPreviewLayout(value: string): value is PreviewLayout {
  return PREVIEW_LAYOUTS.some((layout) => layout === value)
}

/**
 * Radio group in the preview header: arrow keys move focus and pick the layout in one step, like
 * the mesh picker. Shift+P cycles the same three layouts from the canvas.
 */
export function PreviewLayoutPicker() {
  const layout = useEditorStore((state) => effectivePreviewLayout(state.panels))
  const setPreviewLayout = (next: PreviewLayout): void => {
    useEditorStore.getState().setPreviewLayout(next)
  }

  return (
    <ToggleGroup
      type="single"
      size="sm"
      spacing={0}
      aria-label="Preview layout"
      value={layout}
      onValueChange={(next) => {
        // Pressing the chosen item again would clear the group; a layout is always chosen.
        if (isPreviewLayout(next)) setPreviewLayout(next)
      }}
    >
      {PREVIEW_LAYOUTS.map((item) => {
        const { label, hint, icon: Icon } = LAYOUT_OPTIONS[item]
        return (
          <Tooltip key={item}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={item}
                aria-label={label}
                onFocus={() => {
                  if (item !== layout) setPreviewLayout(item)
                }}
                className="size-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Icon aria-hidden="true" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {hint} <Kbd>Shift P</Kbd>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </ToggleGroup>
  )
}
