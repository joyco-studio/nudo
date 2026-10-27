import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useIsAnyOverlayOpen } from '@/shared/lib/overlay-coordinator'
import { cn } from '@/shared/lib/utils'
import { DURATION_MS } from '@/shared/motion/tokens'
import { useOverlayMotion } from '@/shared/motion/use-motion-preset'
import { Tooltip as TooltipPrimitive } from 'radix-ui'

// nudo-tsl: the content animates its exit with motion/react, so it needs the open state itself.
const TooltipOpenContext = React.createContext(false)

// nudo-tsl: reference 17's intent delay (`--duration-micro`), so a passing pointer shows nothing.
// Keyboard focus opens at once, and moving between triggers skips the delay.
function TooltipProvider({
  delayDuration = DURATION_MS.micro,
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
  const isShown = (open ?? isOpen) && !isOverlayOpen
  return (
    <TooltipOpenContext value={isShown}>
      <TooltipPrimitive.Root
        data-slot="tooltip"
        open={isShown}
        onOpenChange={(next) => {
          // A hover under an open overlay is ignored: Radix never reports the leave (the controlled
          // value is already false), so remembering it would show a ghost tooltip later.
          if (next && isOverlayOpen) return
          setIsOpen(next)
          onOpenChange?.(next)
        }}
        {...props}
      />
    </TooltipOpenContext>
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
  const isOpen = React.useContext(TooltipOpenContext)
  const { presence, element, presenceKey } = useOverlayMotion('tooltip', isOpen)
  return (
    <AnimatePresence key={presenceKey} {...presence}>
      {isOpen && (
        <TooltipPrimitive.Portal forceMount key="tooltip">
          <TooltipPrimitive.Content
            data-slot="tooltip-content"
            sideOffset={sideOffset}
            collisionPadding={collisionPadding}
            {...props}
            forceMount
            asChild
          >
            <motion.div
              {...element}
              className={cn(
                'pointer-events-none z-50 inline-flex w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) items-center gap-1.5 rounded-md bg-foreground p-1.5 text-xs text-background has-data-[slot=kbd]:py-1 has-data-[slot=kbd]:pr-1 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm',
                className,
              )}
            >
              {children}
              <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
            </motion.div>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      )}
    </AnimatePresence>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
