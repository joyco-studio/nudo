import { CircleAlert, Info, X } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Alert, AlertAction, AlertDescription } from '@/shared/ui/alert'
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
        // The region above already announces it politely; the alert role would interrupt.
        <Alert
          role="none"
          variant={notice.kind === 'error' ? 'destructive' : 'default'}
          className={cn(
            'pointer-events-auto bg-background/85 py-2 pr-10 backdrop-blur-md',
            notice.kind === 'error' && 'border-destructive',
          )}
        >
          <Icon
            aria-hidden="true"
            className={cn(notice.kind !== 'error' && 'text-muted-foreground')}
          />
          <AlertDescription className="text-xs text-foreground">{notice.message}</AlertDescription>
          <AlertAction className="top-1 right-1">
            <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={onDismiss}>
              <X aria-hidden="true" />
            </Button>
          </AlertAction>
        </Alert>
      )}
    </div>
  )
}
