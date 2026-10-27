import { useState } from 'react'
import type { DragEvent, Ref } from 'react'
import { ImagePlus, TriangleAlert } from 'lucide-react'

import { formatImageSize } from '@/features/assets/texture-thumbnail-source'
import type { ImageSize } from '@/features/assets/texture-thumbnail-source'
import type { TextureSnapshot } from '@/features/assets/texture-cache'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

export type TextureSlotState = TextureSnapshot['state']

const DROP_HINT = 'Or drop one here'
const MISSING_HINT = 'Saved image not found'

export interface TextureSlotProps {
  ref?: Ref<HTMLButtonElement>
  /** The port label, so the accessible name says which input the image is for. */
  label: string
  state: TextureSlotState
  /** The image shown once the texture is ready. */
  source: string | null
  size: ImageSize | null
  onChoose: () => void
  onDropFile: (file: File) => void
}

/** Whether a drag carries files (not text or a link dragged from elsewhere on the page). */
function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer.types.includes('Files')
}

function slotAction(state: TextureSlotState): string {
  return state === 'empty' || state === 'missing' ? 'Choose image' : 'Change image'
}

function slotHint(state: TextureSlotState, size: ImageSize | null): string | null {
  if (state === 'missing') return MISSING_HINT
  if (state === 'empty') return DROP_HINT
  return size === null ? null : formatImageSize(size)
}

function SlotContent({ state, source }: { state: TextureSlotState; source: string | null }) {
  if (state === 'missing') {
    return <TriangleAlert aria-hidden="true" className="size-3.5 text-destructive" />
  }
  if (state === 'empty') return <ImagePlus aria-hidden="true" className="size-3.5" />
  if (source === null) return null
  return (
    // The image is decorative: the button's name and tooltip say what it is.
    <img
      src={source}
      alt=""
      draggable={false}
      className="pointer-events-none size-full object-cover outline -outline-offset-1 outline-[oklch(0_0_0/0.1)] dark:outline-[oklch(1_0_0/0.1)]"
    />
  )
}

/**
 * The square thumbnail of a texture input. Pressing it (or Enter/Space) opens the file chooser, and
 * an image file dropped on it is taken the same way. A checkerboard sits under the image so
 * transparent pixels read as transparent.
 */
export function TextureSlot({
  ref,
  label,
  state,
  source,
  size,
  onChoose,
  onDropFile,
}: TextureSlotProps) {
  const [isDropTarget, setIsDropTarget] = useState(false)
  const action = slotAction(state)
  const hint = slotHint(state, size)
  const showsImage = state === 'ready' || state === 'loading'

  const onDragOver = (event: DragEvent<HTMLButtonElement>): void => {
    if (!carriesFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDropTarget(true)
  }

  const onDrop = (event: DragEvent<HTMLButtonElement>): void => {
    if (!carriesFiles(event)) return
    event.preventDefault()
    setIsDropTarget(false)
    const [file] = event.dataTransfer.files
    if (file !== undefined) onDropFile(file)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          type="button"
          variant="ghost"
          aria-label={`${action} for ${label}`}
          data-texture-state={state}
          data-drop-target={isDropTarget || undefined}
          className={cn(
            'relative size-7 shrink-0 overflow-hidden p-0 text-muted-foreground hover:text-foreground has-[>svg]:p-0',
            showsImage
              ? 'texture-checkerboard hover:bg-transparent'
              : 'border border-border bg-background hover:bg-accent dark:bg-input/30',
            // Drawn above the image, so a file dragged over a thumbnail shows where it will land.
            'data-drop-target:outline-1 data-drop-target:-outline-offset-1 data-drop-target:outline-foreground data-drop-target:outline-solid',
          )}
          onClick={onChoose}
          onDragEnter={onDragOver}
          onDragOver={onDragOver}
          onDragLeave={() => {
            setIsDropTarget(false)
          }}
          onDrop={onDrop}
        >
          <SlotContent state={state} source={source} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="flex flex-col">
          <span>{action}</span>
          {hint !== null && <span className="font-mono text-micro tabular-nums">{hint}</span>}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}
