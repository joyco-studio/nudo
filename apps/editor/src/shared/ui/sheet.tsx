'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import { XIcon } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { useControllableOpen } from '@/shared/lib/use-controllable-open'
import { useMotionPreset, useOverlayMotion } from '@/shared/motion/use-motion-preset'
import { useT } from '@/i18n/use-t'

import { Button } from '@/shared/ui/button'

// nudo-tsl: shadcn's Sheet, animated like dialog.tsx. The content needs the open state itself to
// animate its exit with motion/react.
const SheetOpenContext = React.createContext(false)

function Sheet({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) {
  const [isOpen, setOpen] = useControllableOpen({ open, defaultOpen, onOpenChange })
  return (
    <SheetOpenContext value={isOpen}>
      <SheetPrimitive.Root data-slot="sheet" open={isOpen} onOpenChange={setOpen} {...props} />
    </SheetOpenContext>
  )
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

// nudo-tsl: rendered by SheetContent inside its AnimatePresence; opacity only.
function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  const { element } = useMotionPreset('backdrop')
  return (
    <SheetPrimitive.Overlay data-slot="sheet-overlay" {...props} forceMount asChild>
      <motion.div
        {...element}
        className={cn('fixed inset-0 z-50 bg-black/30 data-closed:pointer-events-none', className)}
      />
    </SheetPrimitive.Overlay>
  )
}

/**
 * nudo-tsl: the editor's sheets enter from the left edge (the panel reveal of the motion rules), so
 * that is the one side this copy keeps. Opened from the keyboard it appears at once.
 */
function SheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const isOpen = React.useContext(SheetOpenContext)
  const { presence, element, presenceKey } = useOverlayMotion('panelReveal', isOpen)
  const t = useT()
  return (
    <AnimatePresence key={presenceKey} {...presence}>
      {isOpen && (
        <SheetPortal forceMount key="sheet">
          <SheetOverlay />
          <SheetPrimitive.Content data-slot="sheet-content" {...props} forceMount asChild>
            <motion.div
              {...element}
              className={cn(
                'fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r bg-background text-sm text-foreground outline-none data-closed:pointer-events-none',
                className,
              )}
            >
              {children}
              {showCloseButton && (
                <SheetPrimitive.Close data-slot="sheet-close" asChild>
                  <Button variant="ghost" className="absolute top-3 right-3" size="icon-sm">
                    <XIcon />
                    <span className="sr-only">{t('common.close')}</span>
                  </Button>
                </SheetPrimitive.Close>
              )}
            </motion.div>
          </SheetPrimitive.Content>
        </SheetPortal>
      )}
    </AnimatePresence>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('font-heading text-base font-medium text-foreground', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
}
