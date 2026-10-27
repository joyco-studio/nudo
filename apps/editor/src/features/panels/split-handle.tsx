import { ResizableHandle } from '@/shared/ui/resizable'
import { useEditorStore } from '@/store/editor-store'

const PERCENT = 100

/**
 * The window splitter between the canvas and the preview (shadcn Resizable, APG window
 * splitter): drag it, or focus it and use the arrow keys (5% a press), Home and End. Its value is
 * the canvas share, 25–75%.
 */
export function SplitHandle() {
  const percent = useEditorStore((state) => state.splitDraftPercent ?? state.panels.splitPercent)

  return (
    <ResizableHandle
      withHandle
      aria-label="Resize preview"
      aria-valuetext={`Canvas ${String(percent)}%, preview ${String(PERCENT - percent)}%`}
      className="z-20 data-[separator=active]:bg-primary data-[separator=hover]:bg-muted-foreground"
    />
  )
}
