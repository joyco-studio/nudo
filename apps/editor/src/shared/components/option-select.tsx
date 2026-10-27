import { MENU_SURFACE_CLASS } from '@/shared/components/menu-surface'
import { CANVAS_ISOLATION_CLASS, isolateFromCanvas } from '@/shared/lib/isolate-from-canvas'
import {
  EXCLUSIVE_TRIGGER_PROPS,
  claimOverlay,
  isOverlayReplaced,
  releaseOverlay,
  useIsOverlayOpen,
} from '@/shared/lib/overlay-coordinator'
import { cn } from '@/shared/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

export interface SelectOption<V extends string> {
  readonly value: V
  readonly label: string
}

export interface OptionSelectProps<V extends string> {
  /** Ties the trigger to its visible `<Label htmlFor>`. */
  id: string
  value: V
  options: readonly SelectOption<V>[]
  onValueChange: (value: V) => void
  /** Mono for node params, which set their values in mono; the UI sans elsewhere. */
  font?: 'mono' | 'sans'
  className?: string
}

/**
 * A compact shadcn Select for a fixed list of options: a 24px trigger with the quiet hairline
 * border of the other fields and a list anchored below (or above) it. Only one overlay is open at
 * a time. The list portals out of a canvas node but keeps its keys and clicks away from React Flow.
 */
export function OptionSelect<V extends string>({
  id,
  value,
  options,
  onValueChange,
  font = 'sans',
  className,
}: OptionSelectProps<V>) {
  const fontClass = font === 'mono' ? 'font-mono' : 'font-sans'
  const isOpen = useIsOverlayOpen(id)

  return (
    <Select
      open={isOpen}
      onOpenChange={(open) => {
        if (open) claimOverlay(id)
        else releaseOverlay(id)
      }}
      value={value}
      onValueChange={(next) => {
        const picked = options.find((option) => option.value === next)
        if (picked !== undefined) onValueChange(picked.value)
      }}
    >
      <SelectTrigger
        id={id}
        size="sm"
        {...EXCLUSIVE_TRIGGER_PROPS}
        // A select has no context menu of its own, and the browser's would be noise here.
        onContextMenu={(event) => {
          event.preventDefault()
        }}
        className={cn(
          // A field to React Flow: its keys (Escape, Enter, arrows) stay with the select.
          'nokey min-w-0 gap-1 rounded-none border-border bg-background focus-visible:border-border py-0 pr-1.5 pl-1.5 text-base text-foreground hover:border-muted-foreground data-[size=sm]:h-6 md:text-field dark:border-border dark:bg-background dark:hover:bg-background [&_svg]:size-3 [&_svg]:text-muted-foreground',
          fontClass,
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        className={cn(
          CANVAS_ISOLATION_CLASS,
          MENU_SURFACE_CLASS,
          'min-w-(--radix-select-trigger-width) p-1',
          fontClass,
        )}
        {...isolateFromCanvas}
        onCloseAutoFocus={(event) => {
          // Replaced by another select: focus belongs to that one's list now.
          if (isOverlayReplaced(id)) event.preventDefault()
        }}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="h-7 rounded-none py-0 pr-8 pl-2 text-xs text-foreground focus:bg-accent focus:text-accent-foreground"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
