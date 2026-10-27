import type { ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

export interface NativeSelectOption<V extends string> {
  readonly value: V
  readonly label: string
}

export interface NativeSelectProps<V extends string> extends Omit<
  ComponentProps<'select'>,
  'value' | 'onChange' | 'children'
> {
  value: V
  options: readonly NativeSelectOption<V>[]
  onValueChange: (value: V) => void
}

/**
 * A compact native `<select>` in the joyco style: sharp corners, a 1px border and mono text. The
 * browser keeps all of its keyboard behavior (arrows, type-ahead, Enter/Space to open).
 */
export function NativeSelect<V extends string>({
  value,
  options,
  onValueChange,
  className,
  ...props
}: NativeSelectProps<V>) {
  return (
    <span className={cn('relative inline-flex min-w-0', className)}>
      <select
        {...props}
        value={value}
        onChange={(event) => {
          const picked = options.find((option) => option.value === event.target.value)
          if (picked !== undefined) onValueChange(picked.value)
        }}
        className="h-6 w-full min-w-0 cursor-pointer appearance-none border border-border bg-background pr-6 pl-1.5 font-mono text-[11px] text-foreground hover:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  )
}
