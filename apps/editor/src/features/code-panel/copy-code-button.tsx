import { useEffect, useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { MessageKey } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'
import { IconSwap } from '@/shared/components/icon-swap'
import { TextMorph } from '@/shared/components/text-morph'
import { Button } from '@/shared/ui/button'

import { useGeneratedCode } from './use-generated-code'

type CopyStatus = 'idle' | 'copied' | 'failed'

/** The confirmation resets after this long, so the next copy gets fresh feedback. */
const FEEDBACK_RESET_MS = 1600

const LABELS: Readonly<Record<CopyStatus, MessageKey>> = {
  idle: 'code.copy',
  copied: 'code.copied',
  failed: 'code.copyFailed',
}

const ICONS: Readonly<Record<CopyStatus, LucideIcon>> = { idle: Copy, copied: Check, failed: X }

interface CopyFeedback {
  readonly status: CopyStatus
  /** Counts copies, so copying again while "Copied" shows restarts the reset. */
  readonly attempt: number
}

/** Writes `text` to the clipboard; false when the browser refuses. */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Copies the generated module. The label morphs to "Copied" (reference 33) as the icon swaps to a
 * check, and a polite status announces the outcome. Disabled while errors keep the module empty.
 */
export function CopyCodeButton() {
  const { code } = useGeneratedCode()
  const t = useT()
  const [feedback, setFeedback] = useState<CopyFeedback>({ status: 'idle', attempt: 0 })

  useEffect(() => {
    if (feedback.status === 'idle') return
    const timer = setTimeout(() => {
      setFeedback((current) => ({ ...current, status: 'idle' }))
    }, FEEDBACK_RESET_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [feedback])

  const copy = async (): Promise<void> => {
    const isCopied = await writeToClipboard(code)
    setFeedback((current) => ({
      status: isCopied ? 'copied' : 'failed',
      attempt: current.attempt + 1,
    }))
  }

  const label = t(LABELS[feedback.status])
  const Icon = ICONS[feedback.status]
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label={label}
        disabled={code === ''}
        onClick={() => {
          void copy()
        }}
      >
        <IconSwap swapKey={feedback.status}>
          <Icon aria-hidden="true" />
        </IconSwap>
        <TextMorph text={label} />
      </Button>
      {/* Stays mounted, so each outcome is announced when it appears. */}
      <span role="status" className="sr-only">
        {feedback.status === 'idle' ? '' : label}
      </span>
    </>
  )
}
