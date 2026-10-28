import type { MessageKey } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'
import { Kbd } from '@/shared/ui/kbd'

export interface KeyHint {
  /** The key or keys to press, as printed on a key cap. */
  readonly keys: string
  readonly action: MessageKey
}

interface KeyHintsProps {
  hints: readonly KeyHint[]
}

/** A footer row of "key → action" hints. Hidden from screen readers, who hear the real roles. */
export function KeyHints({ hints }: KeyHintsProps) {
  const t = useT()
  return (
    <ul aria-hidden="true" className="flex items-center gap-4 text-muted-foreground">
      {hints.map((hint) => (
        <li key={hint.action} className="flex items-center gap-1.5">
          <Kbd>{hint.keys}</Kbd>
          {t(hint.action)}
        </li>
      ))}
    </ul>
  )
}
