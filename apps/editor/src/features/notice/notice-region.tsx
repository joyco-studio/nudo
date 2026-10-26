import { CircleAlert, Info, X } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import type { Notice } from '@/store/store-types'

interface NoticeRegionProps {
  notice: Notice | null
  onDismiss: () => void
}

/**
 * Polite live region for editor notices. The region is always mounted so screen readers pick up
 * a message the moment it appears; the notice stays until dismissed or replaced.
 */
export function NoticeRegion({ notice, onDismiss }: NoticeRegionProps) {
  const Icon = notice?.kind === 'error' ? CircleAlert : Info

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute top-16 left-4 z-20 w-[min(26rem,calc(100%-2rem))]"
    >
      {notice !== null && (
        <div
          className={cn(
            'pointer-events-auto flex items-start gap-2 border bg-background/85 py-1 pr-1 pl-3 backdrop-blur-md',
            notice.kind === 'error' && 'border-destructive',
          )}
        >
          <Icon
            aria-hidden="true"
            className={cn(
              'mt-2 size-3.5 shrink-0',
              notice.kind === 'error' ? 'text-destructive' : 'text-muted-foreground',
            )}
          />
          <p className="flex-1 py-1.5 text-xs">{notice.message}</p>
          <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={onDismiss}>
            <X aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
