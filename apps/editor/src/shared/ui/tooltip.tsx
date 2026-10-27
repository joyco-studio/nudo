import * as React from 'react'
import { useIsAnyOverlayOpen } from '@/shared/lib/overlay-coordinator'
import { cn } from '@/shared/lib/utils'
import { Tooltip as TooltipPrimitive } from 'radix-ui'

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

// nudo-tsl: no tooltip opens over an open menu, select or popover (React Flow nodes keep taking
// the pointer while one is open), so Escape always reaches that overlay first.
function Tooltip({
  open,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)
  const isOverlayOpen = useIsAnyOverlayOpen()
  // An overlay opening drops whatever tooltip was showing, so it can't come back once it closes.
  const [wasOverlayOpen, setWasOverlayOpen] = React.useState(isOverlayOpen)
  if (wasOverlayOpen !== isOverlayOpen) {
    setWasOverlayOpen(isOverlayOpen)
    if (isOverlayOpen) setIsOpen(false)
  }
  return (
    <TooltipPrimitive.Root
      data-slot="tooltip"
      open={(open ?? isOpen) && !isOverlayOpen}
      onOpenChange={(next) => {
        // A hover under an open overlay is ignored: Radix never reports the leave (the controlled
        // value is already false), so remembering it would show a ghost tooltip later.
        if (next && isOverlayOpen) return
        setIsOpen(next)
        onOpenChange?.(next)
      }}
      {...props}
    />
  )
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 4,
  collisionPadding = 8,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'pointer-events-none z-50 inline-flex w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) items-center gap-1.5 rounded-md bg-foreground p-1.5 text-xs text-background has-data-[slot=kbd]:py-1 has-data-[slot=kbd]:pr-1 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
