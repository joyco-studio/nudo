import * as React from 'react'
import { motion } from 'motion/react'
import { cn } from '@/shared/lib/utils'
import { useControllableState } from '@/shared/lib/use-controllable-state'
import { switchThumbTransition } from '@/shared/motion/motion-presets'
import { useMotionMode } from '@/shared/motion/use-motion-preset'
import { Switch as SwitchPrimitive } from 'radix-ui'

type SwitchSize = 'sm' | 'default'

/**
 * nudo-tsl: how far the thumb travels when on, in the switch's own pixels: the track's inner width
 * less the thumb (`calc(100% - 2px)` of the thumb in the shadcn original).
 */
const THUMB_TRAVEL_PX: Readonly<Record<SwitchSize, number>> = { default: 14, sm: 10 }

// nudo-tsl: the thumb travels with reference 27's overshoot as a motion/react transform (instant
// from the keyboard and under reduced motion); the track recolors at once. A transform rather than
// a layout animation: layout animations measure screen pixels, which a zoomed canvas scales.
function Switch({
  className,
  size = 'default',
  checked,
  defaultChecked = false,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: SwitchSize
}) {
  const mode = useMotionMode()
  const [isChecked, setChecked] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  })
  const travelPx = isChecked ? THUMB_TRAVEL_PX[size] : 0
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      checked={isChecked}
      onCheckedChange={setChecked}
      className={cn(
        'peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent outline-none group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" asChild>
        <motion.span
          initial={false}
          animate={{ transform: `translateX(${String(travelPx)}px)` }}
          transition={switchThumbTransition(mode)}
          className="pointer-events-none block rounded-full bg-background ring-0 group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground"
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
