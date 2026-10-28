import { useT } from '@/i18n/use-t'
import { ResizableHandle } from '@/shared/ui/resizable'
import { useEditorStore } from '@/store/editor-store'

import { FULL_PERCENT } from './panel-state'

/**
 * The window splitter between the canvas and the preview (shadcn Resizable, APG window
 * splitter): drag it, or focus it and use the arrow keys (5% a press), Home and End. Its value is
 * the canvas share, 25–75%.
 */
export function SplitHandle() {
  const percent = useEditorStore((state) => state.splitDraftPercent ?? state.panels.splitPercent)
  const t = useT()

  return (
    <ResizableHandle
      withHandle
      aria-label={t('splitHandle.label')}
      aria-valuetext={t('splitHandle.value', { canvas: percent, preview: FULL_PERCENT - percent })}
      className="z-20 data-[separator=active]:bg-primary data-[separator=hover]:bg-muted-foreground"
    />
  )
}
