import { useEffect, useId, useRef } from 'react'

import { useT } from '@/i18n/use-t'
import { cn } from '@/shared/lib/utils'
import { Input } from '@/shared/ui/input'

import { useTextDraft } from './use-text-draft'
import type { TextDraftOptions } from './use-text-draft'

export interface PropertyTextFieldProps extends TextDraftOptions {
  /** The field's id, for a visible `<Label htmlFor>`; or use `accessibleName`. */
  id?: string
  accessibleName?: string
  /** Takes focus with its text selected when it mounts (a rename that just started). */
  isAutoFocused?: boolean
  font: 'mono' | 'sans'
  className?: string
}

/**
 * A compact inline text field for a property's name or reference. Enter or leaving it commits,
 * Escape reverts, and a rejected value shows its reason under the field, announced and linked to
 * it with `aria-describedby`.
 */
export function PropertyTextField({
  id,
  accessibleName,
  isAutoFocused = false,
  font,
  className,
  ...draftOptions
}: PropertyTextFieldProps) {
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const { error, inputProps } = useTextDraft(draftOptions)
  const t = useT()

  useEffect(() => {
    if (!isAutoFocused) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isAutoFocused])

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <Input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        aria-label={accessibleName}
        aria-describedby={error === null ? undefined : errorId}
        {...inputProps}
        className={cn(
          'h-6 min-w-0 rounded-none border-border bg-background px-1.5 py-0 text-base text-foreground hover:border-muted-foreground md:text-field dark:bg-background',
          font === 'mono' ? 'font-mono' : 'font-sans',
          error !== null && 'border-destructive hover:border-destructive',
          // The vendored Input's invalid halo would crowd a 24px row.
          'aria-invalid:ring-0',
        )}
      />
      {error !== null && (
        <p id={errorId} role="alert" className="text-micro leading-4 text-destructive">
          {t(error)}
        </p>
      )}
    </div>
  )
}
