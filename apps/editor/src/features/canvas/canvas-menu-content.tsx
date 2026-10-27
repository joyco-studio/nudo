import type { ComponentProps } from 'react'

import { MENU_SURFACE_CLASS } from '@/shared/components/menu-surface'
import { CANVAS_ISOLATION_CLASS, isolateFromCanvas } from '@/shared/lib/isolate-from-canvas'
import { cn } from '@/shared/lib/utils'
import { ContextMenuContent } from '@/shared/ui/context-menu'

/** A context menu opened on the canvas: its keys and clicks never reach React Flow. */
export function CanvasMenuContent({
  className,
  ...props
}: ComponentProps<typeof ContextMenuContent>) {
  return (
    <ContextMenuContent
      className={cn(CANVAS_ISOLATION_CLASS, MENU_SURFACE_CLASS, 'min-w-48', className)}
      {...isolateFromCanvas}
      {...props}
    />
  )
}
