import { memo, useId } from 'react'
import type { DataType, OutputDefinition } from '@nudo-tsl/core'
import { MASTER_NODE_ID } from '@nudo-tsl/core'
import type { NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react'

import { TypeChip } from '@/shared/components/type-chip'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { InlineField, MutedHint } from './inline-field'
import { NodeContextMenu } from './node-context-menu'
import { PortLabel } from './port-label'
import { SELECTED_FRAME_CLASS } from './selected-frame'
import { ConnectablePort } from './connectable-port'
import { useGraphCanvasActions } from './graph-canvas-actions'
import {
  COLLAPSED_PARAM,
  inputGroups,
  isNodeCollapsed,
  portsToggleLabel,
  visibleOutputs,
} from './node-port-layout'
import type { InputRowModel, PortGroup } from './node-port-layout'
import { ParamFields, bodyParams } from './param-field'
import { PortTypeLabel } from './port-handle'
import { nodeDescriptionId } from './to-flow'
import type { FlowNode, FlowNodeData } from './to-flow'

/**
 * The header is the drag handle, so its description waits a beat and keeps clear of the pointer:
 * a tooltip under the cursor would swallow the press that starts a drag.
 */
const DESCRIPTION_DELAY_MS = 500
const DESCRIPTION_OFFSET_PX = 8

/** Screen reader text for the port type, after the visible label. */
function TypeForAssistiveTech({ dataType }: { dataType: DataType }) {
  return <span className="sr-only">, {dataType}</span>
}

interface InputRowProps {
  data: FlowNodeData
  row: InputRowModel
}

function InputRow({ data, row }: InputRowProps) {
  const { input, disabledHint } = row
  const dataType = data.inputTypes[input.id]
  if (dataType === undefined) return null
  const isConnected = data.connectedInputs.has(input.id)
  const isDisabled = disabledHint !== null

  return (
    <li
      data-port-id={input.id}
      data-disabled={isDisabled || undefined}
      className="relative flex min-h-7 flex-wrap items-center gap-x-1.5 pr-2 pl-3"
    >
      <ConnectablePort
        nodeId={data.node.id}
        portId={input.id}
        side="input"
        dataType={dataType}
        nodeTitle={data.title}
        portLabel={input.label}
        isConnected={isConnected}
      />
      <PortTypeLabel dataType={dataType} />
      {isDisabled ? (
        <>
          <PortLabel label={input.label} isMuted />
          <MutedHint>{disabledHint}</MutedHint>
        </>
      ) : isConnected ? (
        <PortLabel label={input.label} />
      ) : (
        <InlineField node={data.node} input={input} dataType={dataType} />
      )}
      <TypeForAssistiveTech dataType={dataType} />
    </li>
  )
}

interface OutputRowProps {
  data: FlowNodeData
  output: OutputDefinition<string>
  dataType: DataType
}

function OutputRow({ data, output, dataType }: OutputRowProps) {
  return (
    <li
      data-port-id={output.id}
      className="relative flex h-7 items-center justify-end gap-x-1.5 pr-3 pl-2"
    >
      <span className="truncate text-xs">{output.label}</span>
      <TypeForAssistiveTech dataType={dataType} />
      <PortTypeLabel dataType={dataType} />
      <ConnectablePort
        nodeId={data.node.id}
        portId={output.id}
        side="output"
        dataType={dataType}
        nodeTitle={data.title}
        portLabel={output.label}
        isConnected={data.connectedOutputs.has(output.id)}
      />
    </li>
  )
}

/** A titled group (Master Stack "Vertex", "Fragment") is a labelled group, not a landmark. */
function PortGroupList({ group, data }: { group: PortGroup; data: FlowNodeData }) {
  const headingId = useId()
  if (group.rows.length === 0) return null
  const list = (
    <ul>
      {group.rows.map((row) => (
        <InputRow key={row.input.id} data={data} row={row} />
      ))}
    </ul>
  )
  if (group.title === null) return list
  return (
    <div role="group" aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="px-3 pt-2 pb-0.5 font-mono text-micro tracking-[0.2em] text-muted-foreground uppercase"
      >
        {group.title}
      </h3>
      {list}
    </div>
  )
}

/** Disclosure for the unconnected ports: the universal `collapsed` param, which never recompiles. */
function CollapseToggle({ data }: { data: FlowNodeData }) {
  const { setParam } = useGraphCanvasActions()
  const isCollapsed = isNodeCollapsed(data)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* -ml-2 against the header's 12px: 4px from the left edge, as from the top (32 - 24) / 2. */}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Unconnected ports"
          aria-expanded={!isCollapsed}
          onClick={() => {
            setParam({ nodeId: data.node.id, paramId: COLLAPSED_PARAM }, !isCollapsed)
          }}
          className="nodrag -ml-2 text-muted-foreground hover:text-foreground"
        >
          {isCollapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{portsToggleLabel(isCollapsed)}</TooltipContent>
    </Tooltip>
  )
}

function NodeHeader({ data }: { data: FlowNodeData }) {
  const { definition } = data
  const hasPorts = definition.inputs.length + definition.outputs.length > 0

  return (
    <header className="flex h-8 items-center gap-1 border-b bg-muted/50 px-3">
      {hasPorts && <CollapseToggle data={data} />}
      <Tooltip delayDuration={DESCRIPTION_DELAY_MS}>
        <TooltipTrigger asChild>
          <h2 className="truncate font-heading text-xs font-semibold tracking-wide uppercase">
            {data.title}
          </h2>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={DESCRIPTION_OFFSET_PX}
          className="pointer-events-none"
        >
          {definition.description}
        </TooltipContent>
      </Tooltip>
    </header>
  )
}

function NodeError({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-1.5 border-t border-destructive px-3 py-2 text-xs text-destructive">
      <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

function nodeFrameClass(data: FlowNodeData, selected: boolean): string {
  return cn(
    'graph-node flex flex-col border bg-card text-card-foreground',
    selected && SELECTED_FRAME_CLASS,
    data.error !== undefined && 'border-destructive',
  )
}

/** A Blackboard property reader: one row with the property label, its type and the output. */
function PropertyPill({ data, selected }: { data: FlowNodeData; selected: boolean }) {
  const [output] = data.definition.outputs
  const dataType = output === undefined ? undefined : data.outputTypes[output.id]
  if (output === undefined || dataType === undefined) return null

  return (
    <NodeContextMenu data={data}>
      <div
        data-error={data.error !== undefined}
        className={cn(nodeFrameClass(data, selected), 'w-44')}
      >
        <p id={nodeDescriptionId(data.node.id)} className="sr-only">
          {data.definition.description}
        </p>
        <div data-port-id={output.id} className="relative flex h-7 items-center gap-2 pr-3 pl-3">
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{data.title}</span>
          <TypeChip>{dataType}</TypeChip>
          <ConnectablePort
            nodeId={data.node.id}
            portId={output.id}
            side="output"
            dataType={dataType}
            nodeTitle={data.title}
            portLabel={output.label}
            isConnected={data.connectedOutputs.has(output.id)}
          />
        </div>
        {data.error !== undefined && <NodeError message={data.error} />}
      </div>
    </NodeContextMenu>
  )
}

/** A graph node: header, params, outputs on the right, inputs (with inline fields) on the left. */
function NodeViewComponent({ data, selected }: NodeProps<FlowNode>) {
  const { definition, node, outputTypes, error } = data
  if (definition.reads === 'property') return <PropertyPill data={data} selected={selected} />

  const params = bodyParams(definition.params)
  const outputs = visibleOutputs(data)
  const groups = inputGroups(data)
  const hasInputs = groups.some((group) => group.rows.length > 0)

  return (
    <NodeContextMenu data={data}>
      <div
        data-error={error !== undefined}
        className={cn(nodeFrameClass(data, selected), node.id === MASTER_NODE_ID ? 'w-64' : 'w-56')}
      >
        <p id={nodeDescriptionId(node.id)} className="sr-only">
          {definition.description}
        </p>
        <NodeHeader data={data} />
        {params.length > 0 && <ParamFields node={node} params={params} />}
        {outputs.length > 0 && (
          <ul className="py-1">
            {outputs.map((output) => {
              const dataType = outputTypes[output.id]
              return dataType === undefined ? null : (
                <OutputRow key={output.id} data={data} output={output} dataType={dataType} />
              )
            })}
          </ul>
        )}
        {hasInputs && (
          <div className={cn('pb-1', outputs.length > 0 && 'border-t pt-1')}>
            {groups.map((group) => (
              <PortGroupList key={group.title ?? 'inputs'} group={group} data={data} />
            ))}
          </div>
        )}
        {error !== undefined && <NodeError message={error} />}
      </div>
    </NodeContextMenu>
  )
}

export const NodeView = memo(NodeViewComponent)
