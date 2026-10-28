'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/shared/lib/utils'
import { useControllableOpen } from '@/shared/lib/use-controllable-open'
import { useMotionPreset, useOverlayMotion } from '@/shared/motion/use-motion-preset'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useT } from '@/i18n/use-t'

import { Button } from '@/shared/ui/button'
import { XIcon } from 'lucide-react'

// nudo-tsl: the content animates its exit with motion/react, so it needs the open state itself.
const DialogOpenContext = React.createContext(false)

/**
 * `dialog` scales from 0.96 around the center; `quickFade` is the one fast fade for surfaces opened
 * many times a day (the add-node menu). Either way a dialog opened from the keyboard is instant.
 */
type DialogMotion = 'dialog' | 'quickFade'

function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [isOpen, setOpen] = useControllableOpen({ open, defaultOpen, onOpenChange })
  return (
    <DialogOpenContext value={isOpen}>
      <DialogPrimitive.Root data-slot="dialog" open={isOpen} onOpenChange={setOpen} {...props} />
    </DialogOpenContext>
  )
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

// nudo-tsl: rendered by DialogContent inside its AnimatePresence; opacity only.
function DialogOverlay({
  className,
  motionPreset = 'backdrop',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay> & {
  motionPreset?: 'backdrop' | 'quickFade'
}) {
  const { element } = useMotionPreset(motionPreset)
  return (
    <DialogPrimitive.Overlay data-slot="dialog-overlay" {...props} forceMount asChild>
      <motion.div
        {...element}
        className={cn(
          'fixed inset-0 isolate z-50 bg-black/10 data-closed:pointer-events-none supports-backdrop-filter:backdrop-blur-xs',
          className,
        )}
      />
    </DialogPrimitive.Overlay>
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  motionPreset = 'dialog',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  motionPreset?: DialogMotion
}) {
  const isOpen = React.useContext(DialogOpenContext)
  const { presence, element, presenceKey } = useOverlayMotion(motionPreset, isOpen)
  // nudo-tsl: the close button is named in the UI language.
  const t = useT()
  return (
    <AnimatePresence key={presenceKey} {...presence}>
      {isOpen && (
        <DialogPortal forceMount key="dialog">
          <DialogOverlay motionPreset={motionPreset === 'dialog' ? 'backdrop' : 'quickFade'} />
          <DialogPrimitive.Content data-slot="dialog-content" {...props} forceMount asChild>
            <motion.div
              {...element}
              className={cn(
                'fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none data-closed:pointer-events-none sm:max-w-sm',
                className,
              )}
            >
              {children}
              {showCloseButton && (
                <DialogPrimitive.Close data-slot="dialog-close" asChild>
                  <Button variant="ghost" className="absolute top-2 right-2" size="icon-sm">
                    <XIcon />
                    <span className="sr-only">{t('common.close')}</span>
                  </Button>
                </DialogPrimitive.Close>
              )}
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPortal>
      )}
    </AnimatePresence>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="dialog-header" className={cn('flex flex-col gap-2', className)} {...props} />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean
}) {
  const t = useT()
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        '-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">{t('common.close')}</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('font-heading text-base leading-none font-medium', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        'text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
