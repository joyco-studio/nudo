import { Component } from 'react'
import type { ReactNode } from 'react'
import { MonitorX } from 'lucide-react'

import { Alert, AlertDescription } from '@/shared/ui/alert'

import { RendererUnavailableError } from './renderer-unavailable-error'

export const RENDERER_UNAVAILABLE_MESSAGE =
  'Preview unavailable. Open the editor in a current Chrome, Edge or Safari to see the material.'
export const PREVIEW_CRASHED_MESSAGE =
  'Preview stopped unexpectedly. Reload the page to restart it.'

type PreviewFailure = 'renderer-unavailable' | 'crashed'

const FAILURE_MESSAGES: Readonly<Record<PreviewFailure, string>> = {
  'renderer-unavailable': RENDERER_UNAVAILABLE_MESSAGE,
  crashed: PREVIEW_CRASHED_MESSAGE,
}

interface PreviewErrorBoundaryProps {
  children: ReactNode
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

  override render() {
    const { failure } = this.state
    if (failure === null) return this.props.children
    return (
      <div className="grid aspect-square place-items-center p-4">
        <Alert>
          <MonitorX aria-hidden="true" />
          <AlertDescription className="text-xs text-foreground">
            {FAILURE_MESSAGES[failure]}
          </AlertDescription>
        </Alert>
      </div>
    )
  }
}
