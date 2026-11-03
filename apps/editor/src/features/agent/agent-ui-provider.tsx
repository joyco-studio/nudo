import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'
import { useEditorStore } from '@/store/editor-store'

import type { AgentBridgeHandle } from './agent-bridge'
import { AgentConfirmDialog } from './agent-confirm-dialog'
import type { FocusTargetFor } from './agent-confirm-dialog'
import { AgentConnectDialog } from './agent-connect-dialog'
import { AgentUiContext } from './agent-ui-context'
import type { AgentUi } from './agent-ui-context'
import { chipPressFor, panelChangeFor } from './agent-ui-model'
import type { ConfirmBroker } from './confirm-broker'

interface AgentUiProviderProps {
  bridge: AgentBridgeHandle
  confirmBroker: ConfirmBroker
  children: ReactNode
}

const activeElement = (): HTMLElement | null =>
  document.activeElement instanceof HTMLElement ? document.activeElement : null

/**
 * Owns the agent UI state: whether the activity panel is open (a new task opens it, its end
 * collapses it), the connect dialog and the confirm dialog the agent tools and Undo all ask through.
 */
export function AgentUiProvider({ bridge, confirmBroker, children }: AgentUiProviderProps) {
  const panelId = useId()
  const chipElementRef = useRef<HTMLButtonElement | null>(null)
  const registerChip = useCallback((element: HTMLButtonElement | null) => {
    chipElementRef.current = element
  }, [])
  const [isPanelOpen, setIsPanelOpen] = useState(
    () => useEditorStore.getState().agentTask?.status === 'active',
  )
  const [panelFocusRequest, setPanelFocusRequest] = useState(0)
  // True while the panel is open because a task started, not because the person opened it.
  const wasOpenedByTaskRef = useRef(isPanelOpen)
  const [isConnectOpen, setIsConnectOpen] = useState(false)
  const [agentKey, setAgentKey] = useState<string | null>(null)
  const connectOpenerRef = useRef<HTMLElement | null>(null)

  useEffect(
    () =>
      useEditorStore.subscribe((state, previous) => {
        if (state.agentTask === previous.agentTask) return
        const change = panelChangeFor(previous.agentTask, state.agentTask)
        if (change === null) return
        if (change === 'collapse') {
          // Focus inside the panel would be lost with it: hand it to the toolbar control.
          const panel = document.getElementById(panelId)
          if (panel?.contains(document.activeElement) === true) chipElementRef.current?.focus()
        }
        wasOpenedByTaskRef.current = change === 'open'
        setIsPanelOpen(change === 'open')
      }),
    [panelId],
  )

  const togglePanel = useCallback(() => {
    const press = chipPressFor(isPanelOpen, wasOpenedByTaskRef.current)
    wasOpenedByTaskRef.current = false
    if (press === 'collapse') {
      setIsPanelOpen(false)
      return
    }
    setPanelFocusRequest((request) => request + 1)
    setIsPanelOpen(true)
  }, [isPanelOpen])

  const collapsePanel = useCallback(() => {
    wasOpenedByTaskRef.current = false
    setIsPanelOpen(false)
    chipElementRef.current?.focus()
  }, [])

  const isPanelOpenRef = useRef(isPanelOpen)
  useEffect(() => {
    isPanelOpenRef.current = isPanelOpen
  }, [isPanelOpen])

  /**
   * A confirm opened from the panel (Undo all) returns focus there, unless the panel collapsed
   * meanwhile (the task finished: the toolbar control takes it) or the opener is now disabled.
   */
  const confirmFocusTarget = useCallback<FocusTargetFor>(
    (opener) => {
      const panel = document.getElementById(panelId)
      if (opener === null || panel?.contains(opener) !== true) return opener
      if (!isPanelOpenRef.current) return chipElementRef.current
      return opener instanceof HTMLButtonElement && opener.disabled ? panel : opener
    },
    [panelId],
  )

  const openConnectDialog = useCallback(() => {
    connectOpenerRef.current = activeElement()
    setAgentKey(bridge.connect() ?? bridge.currentKey())
    setIsConnectOpen(true)
  }, [bridge])

  // Another tab may generate a new key: the dialog shows the command that works now.
  useEffect(
    () =>
      bridge.subscribeKey(() => {
        setAgentKey(bridge.currentKey())
      }),
    [bridge],
  )

  const generateNewKey = useCallback(() => {
    setAgentKey(bridge.generateNewKey())
  }, [bridge])

  const restoreConnectFocus = useCallback(() => {
    focusOpenerOrCanvas(connectOpenerRef.current ?? chipElementRef.current)
  }, [])

  const confirm = useCallback(
    (kind: Parameters<ConfirmBroker['request']>[0]) => confirmBroker.request(kind),
    [confirmBroker],
  )

  const ui = useMemo<AgentUi>(
    () => ({
      panelId,
      isPanelOpen,
      panelFocusRequest,
      registerChip,
      togglePanel,
      collapsePanel,
      openConnectDialog,
      confirm,
    }),
    [
      panelId,
      isPanelOpen,
      panelFocusRequest,
      registerChip,
      togglePanel,
      collapsePanel,
      openConnectDialog,
      confirm,
    ],
  )

  return (
    <AgentUiContext value={ui}>
      {children}
      <AgentConnectDialog
        open={isConnectOpen}
        onOpenChange={setIsConnectOpen}
        url={bridge.url}
        agentKey={agentKey}
        onGenerateKey={generateNewKey}
        restoreFocus={restoreConnectFocus}
      />
      <AgentConfirmDialog broker={confirmBroker} focusTargetFor={confirmFocusTarget} />
    </AgentUiContext>
  )
}
