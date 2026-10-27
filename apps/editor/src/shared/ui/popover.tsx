'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/shared/lib/utils'
import { useControllableOpen } from '@/shared/lib/use-controllable-open'
import { useOverlayMotion } from '@/shared/motion/use-motion-preset'
import { Popover as PopoverPrimitive } from 'radix-ui'

// nudo-tsl: the content animates its exit with motion/react, so it needs the open state itself.
const PopoverOpenContext = React.createContext(false)

function Popover({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  const [isOpen, setOpen] = useControllableOpen({ open, defaultOpen, onOpenChange })
  return (
    <PopoverOpenContext value={isOpen}>
      <PopoverPrimitive.Root data-slot="popover" open={isOpen} onOpenChange={setOpen} {...props} />
    </PopoverOpenContext>
  )
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

/** True when `target` is the trigger that controls `content` (Radix points it there by id). */
function isOwnTrigger(target: EventTarget | null, content: HTMLElement | null): boolean {
  if (!(target instanceof Element) || content === null || content.id === '') return false
  return target.closest(`[aria-controls="${CSS.escape(content.id)}"]`) !== null
}

// nudo-tsl: grows from its trigger (the menu preset); Radix stays mounted through the exit.
function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  children,
  onPointerDownOutside,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const isOpen = React.useContext(PopoverOpenContext)
  const { presence, element, presenceKey } = useOverlayMotion('menu', isOpen)
  const contentRef = React.useRef<HTMLDivElement>(null)
  return (
    <AnimatePresence key={presenceKey} {...presence}>
      {isOpen && (
        <PopoverPrimitive.Portal forceMount key="popover">
          <PopoverPrimitive.Content
            data-slot="popover-content"
            align={align}
            sideOffset={sideOffset}
            {...props}
            onPointerDownOutside={(event) => {
              onPointerDownOutside?.(event)
              // nudo-tsl: an exclusive trigger stays pressable over a modal popover, and its own
              // press toggles the popover. Radix dismisses outside presses on the click that
              // follows, which would undo a reopen pressed while the popover was leaving.
              if (isOwnTrigger(event.detail.originalEvent.target, contentRef.current)) {
                event.preventDefault()
              }
            }}
            forceMount
            asChild
          >
            <motion.div
              ref={contentRef}
              {...element}
              className={cn(
                'z-50 flex w-72 origin-(--radix-popover-content-transform-origin) flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden data-closed:pointer-events-none',
                className,
              )}
            >
              {children}
            </motion.div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      )}
    </AnimatePresence>
  )
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="popover-header"
      className={cn('flex flex-col gap-0.5 text-sm', className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <div data-slot="popover-title" className={cn('font-medium', className)} {...props} />
}

function PopoverDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="popover-description"
      className={cn('text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}
