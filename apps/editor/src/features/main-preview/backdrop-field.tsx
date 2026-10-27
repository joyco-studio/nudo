import { useId } from 'react'

import { PREVIEW_BACKDROPS } from '@/features/panels/panel-state'
import type { PreviewBackdrop } from '@/features/panels/panel-state'
import { OptionSelect } from '@/shared/components/option-select'
import { Label } from '@/shared/ui/label'
import { useEditorStore } from '@/store/editor-store'

const BACKDROP_LABELS: Readonly<Record<PreviewBackdrop, string>> = {
  none: 'None',
  'checker-room': 'Checker room',
}

const BACKDROP_OPTIONS = PREVIEW_BACKDROPS.map((value) => ({
  value,
  label: BACKDROP_LABELS[value],
}))

/**
 * Picks what stands behind the mesh: nothing, or a checker floor and wall so screen-space nodes
 * (Scene Color, Depth Fade) have something to sample. Persisted with the panel preferences.
 */
export function BackdropField() {
  const backdrop = useEditorStore((state) => state.panels.backdrop)
  const selectId = useId()

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={selectId} className="text-xs font-normal text-muted-foreground">
        Backdrop
      </Label>
      <OptionSelect
        id={selectId}
        value={backdrop}
        options={BACKDROP_OPTIONS}
        onValueChange={(next) => {
          useEditorStore.getState().setPreviewBackdrop(next)
        }}
        className="w-32"
      />
    </div>
  )
}
