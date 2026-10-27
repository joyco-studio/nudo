import { useCallback, useMemo, useRef, useState } from 'react'
import type { DataType } from '@nudo-tsl/core'

import { useGraphCanvasActions } from './graph-canvas-actions'
import { KeyboardConnectList } from './keyboard-connect-list'
import type { PortExplanation } from './node-explanation'
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
  explanation: PortExplanation
}

function accessibleNameOf(props: ConnectablePortProps): string {
  const connection = props.isConnected ? 'connected' : 'not connected'
  return `${props.portLabel}, ${props.side} port, ${props.dataType}, ${connection}`
}

/**
 * A port that works with the mouse (drag the handle) and the keyboard: Tab to it, Enter opens the
 * list of compatible ports, Delete disconnects it.
 */
export function ConnectablePort(props: ConnectablePortProps) {
  const { nodeId, portId, side, dataType, nodeTitle, portLabel } = props
  const actions = useGraphCanvasActions()
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
        accessibleName={accessibleNameOf(props)}
        explanation={props.explanation}
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
