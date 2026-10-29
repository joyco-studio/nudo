import { Component } from 'react'
import type { ReactNode } from 'react'
import { MonitorX } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import type { MessageKey } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'

import { RendererUnavailableError } from './renderer-unavailable-error'

type PreviewFailure = 'renderer-unavailable' | 'crashed'

const FAILURE_MESSAGES: Readonly<Record<PreviewFailure, MessageKey>> = {
  'renderer-unavailable': 'preview.unavailable',
  crashed: 'preview.crashed',
}

/** The failure in the UI language (the boundary is a class, so a function component reads it). */
function FailureMessage({ failure }: { failure: PreviewFailure }) {
  const t = useT()
  return <>{t(FAILURE_MESSAGES[failure])}</>
}

interface PreviewErrorBoundaryProps {
  children: ReactNode
  /** Told once the preview failed, so whatever sits over it (a loading state) can step aside. */
  onFailure?: () => void
  /** Sizes the failure message's box; a square by default, like the docked preview. */
  fallbackClassName?: string
}

interface PreviewErrorBoundaryState {
  failure: PreviewFailure | null
}

/**
 * The preview must never take the editor down with it. R3F reports a failed renderer factory by
 * throwing during render, so this turns that (and any other preview crash) into a message.
 */
export class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  override state: PreviewErrorBoundaryState = { failure: null }

  static getDerivedStateFromError(error: unknown): PreviewErrorBoundaryState {
    return {
      failure: error instanceof RendererUnavailableError ? 'renderer-unavailable' : 'crashed',
    }
  }

  override componentDidCatch(): void {
    this.props.onFailure?.()
  }

  override render() {
    const { failure } = this.state
    if (failure === null) return this.props.children
    return (
      <div
        className={cn(
          'grid place-items-center p-4',
          this.props.fallbackClassName ?? 'aspect-square',
        )}
      >
        <Alert>
          <MonitorX aria-hidden="true" />
          <AlertDescription className="text-xs text-foreground">
            <FailureMessage failure={failure} />
          </AlertDescription>
        </Alert>
      </div>
    )
  }
}
