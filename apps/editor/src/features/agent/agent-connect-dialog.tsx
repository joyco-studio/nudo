import { useEffect, useState } from 'react'
import { Check, Copy, KeyRound, RotateCw, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { MessageKey } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'
import { writeToClipboard } from '@/shared/lib/write-to-clipboard'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { useEditorStore } from '@/store/editor-store'

import { connectCommand, connectionStatusKey } from './agent-ui-model'

type CopyStatus = 'idle' | 'copied' | 'failed'

/** The confirmation resets after this long, so the next copy gets fresh feedback. */
const FEEDBACK_RESET_MS = 1600

const COPY_LABELS: Readonly<Record<CopyStatus, MessageKey>> = {
  idle: 'agent.connect.copy',
  copied: 'agent.connect.copied',
  failed: 'agent.connect.copyFailed',
}

const COPY_ICONS: Readonly<Record<CopyStatus, LucideIcon>> = {
  idle: Copy,
  copied: Check,
  failed: X,
}

function CopyCommandButton({ command }: { command: string }) {
  const t = useT()
  const [status, setStatus] = useState<CopyStatus>('idle')

  useEffect(() => {
    if (status === 'idle') return
    const timer = setTimeout(() => {
      setStatus('idle')
    }, FEEDBACK_RESET_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [status])

  const Icon = COPY_ICONS[status]
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label={t('agent.connect.copyAction')}
        onClick={() => {
          void writeToClipboard(command).then((isCopied) => {
            setStatus(isCopied ? 'copied' : 'failed')
          })
        }}
      >
        <Icon aria-hidden="true" />
        {t(COPY_LABELS[status])}
      </Button>
      <span role="status" className="sr-only">
        {status === 'idle' ? '' : t(COPY_LABELS[status])}
      </span>
    </>
  )
}

interface CommandBlockProps {
  url: string
  agentKey: string
  onGenerateKey: () => void
}

function CommandBlock({ url, agentKey, onGenerateKey }: CommandBlockProps) {
  const t = useT()
  const command = connectCommand(url, agentKey)
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-xs leading-5 whitespace-pre-wrap break-all">
          <code>{command}</code>
        </pre>
        <div className="flex justify-end">
          <CopyCommandButton command={command} />
        </div>
      </div>
      <p className="flex gap-2 text-xs text-muted-foreground">
        <KeyRound aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>{t('agent.connect.keyWarning')}</span>
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button variant="ghost" size="sm" onClick={onGenerateKey}>
          <RotateCw aria-hidden="true" />
          {t('agent.connect.newKey')}
        </Button>
        <span className="text-xs text-muted-foreground">{t('agent.connect.newKeyHint')}</span>
      </div>
    </div>
  )
}

/** The connection in words, with a way out when the tab is outdated. */
function ConnectionStatusLine({ isConfigured }: { isConfigured: boolean }) {
  const t = useT()
  const status = useEditorStore((state) => state.agentConnection)
  const isOutdated = isConfigured && status === 'outdated'
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
      <p role="status" className="min-w-0 flex-1">
        {t(connectionStatusKey(status, isConfigured))}
      </p>
      {isOutdated ? (
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            window.location.reload()
          }}
        >
          {t('agent.connect.reload')}
        </Button>
      ) : null}
    </div>
  )
}

export interface AgentConnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The Worker URL; null when this build has none, and the dialog says so. */
  url: string | null
  agentKey: string | null
  onGenerateKey: () => void
  /** Runs after the dialog closes, in place of Radix's default, to put focus back. */
  restoreFocus: () => void
}

/**
 * How to connect an agent: the command to paste (with the key in its header), a warning that the
 * key is a secret, a way to replace the key, and the connection status in words.
 */
export function AgentConnectDialog({
  open,
  onOpenChange,
  url,
  agentKey,
  onGenerateKey,
  restoreFocus,
}: AgentConnectDialogProps) {
  const t = useT()
  const isConfigured = url !== null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        // Unconfigured, the status line is all there is to say; it needs no description.
        {...(isConfigured ? {} : { 'aria-describedby': undefined })}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          restoreFocus()
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold tracking-wide uppercase">
            {t('agent.connect.title')}
          </DialogTitle>
          {isConfigured ? (
            <DialogDescription>{t('agent.connect.description')}</DialogDescription>
          ) : null}
        </DialogHeader>
        {url !== null && agentKey !== null ? (
          <CommandBlock url={url} agentKey={agentKey} onGenerateKey={onGenerateKey} />
        ) : null}
        <ConnectionStatusLine isConfigured={isConfigured} />
      </DialogContent>
    </Dialog>
  )
}
