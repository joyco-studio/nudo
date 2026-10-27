import type { LucideIcon } from 'lucide-react'
import { Columns2, Maximize2, PictureInPicture2 } from 'lucide-react'

import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { useEditorStore } from '@/store/editor-store'

import { PREVIEW_LAYOUTS, effectivePreviewLayout } from './panel-state'
import type { PreviewLayout } from './panel-state'

interface LayoutOption {
  readonly label: string
  readonly icon: LucideIcon
}

const LAYOUT_OPTIONS: Readonly<Record<PreviewLayout, LayoutOption>> = {
  docked: { label: 'Docked', icon: PictureInPicture2 },
  split: { label: 'Split', icon: Columns2 },
  full: { label: 'Full', icon: Maximize2 },
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
      // Shift+P cycles the three layouts; the shortcuts dialog lists it too.
      aria-keyshortcuts="Shift+P"
      value={layout}
      onValueChange={(next) => {
        // Pressing the chosen item again would clear the group; a layout is always chosen.
        if (isPreviewLayout(next)) setPreviewLayout(next)
      }}
    >
      {PREVIEW_LAYOUTS.map((item) => {
        const { label, icon: Icon } = LAYOUT_OPTIONS[item]
        return (
          // The tooltip trigger writes its own data-state over the item's, so the checked style keys
          // off aria-checked, which only the radio sets.
          <Tooltip key={item}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={item}
                aria-label={label}
                onFocus={() => {
                  if (item !== layout) setPreviewLayout(item)
                }}
                className="size-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground aria-checked:bg-primary aria-checked:text-primary-foreground"
              >
                <Icon aria-hidden="true" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </ToggleGroup>
  )
}
