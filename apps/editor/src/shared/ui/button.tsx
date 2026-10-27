import * as React from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/utils'
import { PRESS_FEEDBACK } from '@/shared/motion/motion-presets'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-[color,background-color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive rounded-md",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        muted: 'bg-muted text-muted-foreground hover:bg-accent/50',
        accent: 'bg-accent text-accent-foreground hover:bg-accent/80',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 text-xs gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3.5",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
        'icon-aside': 'size-aside-width',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

const MotionSlot = motion.create(Slot.Root)

// nudo-tsl: motion/react owns the inline style and the drag and animation-start handlers.
type ButtonProps = Omit<
  React.ComponentProps<'button'>,
  'style' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'
> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** No press scale: for canvas-dense controls and toolbar icon buttons, where motion distracts. */
    static?: boolean
  }

// nudo-tsl: better-ui scale on press (0.96) through motion/react, off under reduced motion.
function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  static: isStatic = false,
  ...props
}: ButtonProps) {
  const prefersReducedMotion = useReducedMotion() === true
  const slotProps = {
    'data-slot': 'button',
    'data-variant': variant,
    'data-size': size,
    className: cn(buttonVariants({ variant, size, className })),
  }

  if (isStatic || prefersReducedMotion) {
    const Comp = asChild ? Slot.Root : 'button'
    return <Comp {...slotProps} {...props} />
  }
  if (asChild) return <MotionSlot {...slotProps} {...PRESS_FEEDBACK} {...props} />
  return <motion.button {...slotProps} {...PRESS_FEEDBACK} {...props} />
}

export { Button, buttonVariants }
