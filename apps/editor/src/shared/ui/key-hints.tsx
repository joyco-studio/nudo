import { Kbd } from '@/shared/ui/kbd'

export interface KeyHint {
  /** The key or keys to press, as printed on a key cap. */
  readonly keys: string
  readonly action: string
}

interface KeyHintsProps {
  hints: readonly KeyHint[]
}

/** A footer row of "key → action" hints. Hidden from screen readers, who hear the real roles. */
export function KeyHints({ hints }: KeyHintsProps) {
  return (
    <ul aria-hidden="true" className="flex items-center gap-4 text-muted-foreground">
      {hints.map((hint) => (
        <li key={hint.action} className="flex items-center gap-1.5">
          <Kbd>{hint.keys}</Kbd>
          {hint.action}
        </li>
      ))}
    </ul>
  )
}
