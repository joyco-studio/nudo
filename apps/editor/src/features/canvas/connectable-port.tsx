import { useCallback, useMemo, useRef, useState } from 'react'
import type { DataType } from '@nudo-tsl/core'

import type { Translate } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'

import { useGraphCanvasActions } from './graph-canvas-actions'
import { KeyboardConnectList } from './keyboard-connect-list'
import { PortHandle } from './port-handle'
import type { ConnectOrigin, PortSide } from './connect-candidates'

export interface ConnectablePortProps {
  nodeId: ConnectOrigin['ref']['nodeId']
  portId: string
  side: PortSide
  dataType: DataType
  nodeTitle: string
  portLabel: string
  isConnected: boolean
}

function accessibleNameOf(props: ConnectablePortProps, t: Translate): string {
  return t('port.name', {
    port: props.portLabel,
    side: t(props.side === 'input' ? 'port.side.input' : 'port.side.output'),
    type: props.dataType,
    connection: t(props.isConnected ? 'port.connected' : 'port.notConnected'),
  })
}

/**
 * A port that works with the mouse (drag the handle) and the keyboard: Tab to it, Enter opens the
 * list of compatible ports, Delete disconnects it.
 */
export function ConnectablePort(props: ConnectablePortProps) {
  const { nodeId, portId, side, dataType, nodeTitle, portLabel } = props
  const actions = useGraphCanvasActions()
  const t = useT()
  const [isListOpen, setIsListOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const origin = useMemo<ConnectOrigin>(
    () => ({ side, ref: { nodeId, portId } }),
    [side, nodeId, portId],
  )
  const loadCandidates = useCallback(() => actions.listConnectCandidates(origin), [actions, origin])

  return (
    <>
      <PortHandle
        portId={portId}
        side={side}
        dataType={dataType}
        accessibleName={accessibleNameOf(props, t)}
        buttonRef={buttonRef}
        onActivate={() => {
          setIsListOpen(true)
        }}
        onDisconnect={() => {
          actions.disconnectPort(origin)
        }}
      />
      <KeyboardConnectList
        open={isListOpen}
        onOpenChange={setIsListOpen}
        title={`${nodeTitle} › ${portLabel}`}
        anchorRef={buttonRef}
        loadCandidates={loadCandidates}
        onPick={(candidate) => {
          actions.connectPorts(origin, candidate.ref)
          setIsListOpen(false)
        }}
        restoreFocus={() => {
          buttonRef.current?.focus({ preventScroll: true })
        }}
      />
    </>
  )
}
