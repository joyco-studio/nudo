import { memo } from 'react'
import type { DataType, InputDefinition, OutputDefinition } from '@nudo-tsl/core'
import { MASTER_NODE_ID } from '@nudo-tsl/core'
import type { NodeProps } from '@xyflow/react'
import { TriangleAlert } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { InlineField, PortLabel } from './inline-field'
import { PortHandle, PortTypeLabel } from './port-handle'
import { nodeTitle } from './to-flow'
import type { FlowNode, FlowNodeData } from './to-flow'

/** Master Stack inputs that run in the vertex stage; every other input is a fragment input. */
/**
 * The header is the drag handle, so its description waits a beat and keeps clear of the pointer:
 * a tooltip under the cursor would swallow the press that starts a drag.
 */
const DESCRIPTION_DELAY_MS = 500
const DESCRIPTION_OFFSET_PX = 8

const VERTEX_INPUT_IDS: ReadonlySet<string> = new Set(['position'])

interface PortGroup {
  readonly title: string | null
  readonly inputs: readonly InputDefinition<string>[]
}

function inputGroups(data: FlowNodeData): readonly PortGroup[] {
  const { inputs } = data.definition
  if (data.node.id !== MASTER_NODE_ID) return [{ title: null, inputs }]
  return [
    { title: 'Vertex', inputs: inputs.filter((input) => VERTEX_INPUT_IDS.has(input.id)) },
    { title: 'Fragment', inputs: inputs.filter((input) => !VERTEX_INPUT_IDS.has(input.id)) },
  ]
}

/** Screen reader text for the port type, after the visible label. */
function TypeForAssistiveTech({ dataType }: { dataType: DataType }) {
  return <span className="sr-only">, {dataType}</span>
}

interface InputRowProps {
  data: FlowNodeData
  input: InputDefinition<string>
}

function InputRow({ data, input }: InputRowProps) {
  const dataType = data.inputTypes[input.id]
  if (dataType === undefined) return null
  const isConnected = data.connectedInputs.has(input.id)

  return (
    <li
      data-port-id={input.id}
      className="relative flex min-h-7 flex-wrap items-center gap-x-1.5 pr-2 pl-3"
    >
      <PortHandle portId={input.id} side="input" dataType={dataType} />
      <PortTypeLabel dataType={dataType} />
      {isConnected ? (
        <PortLabel label={input.label} />
      ) : (
        <InlineField node={data.node} input={input} dataType={dataType} />
      )}
      <TypeForAssistiveTech dataType={dataType} />
    </li>
  )
}

interface OutputRowProps {
  output: OutputDefinition<string>
  dataType: DataType
}

function OutputRow({ output, dataType }: OutputRowProps) {
  return (
    <li
      data-port-id={output.id}
      className="relative flex h-7 items-center justify-end gap-x-1.5 pr-3 pl-2"
    >
      <span className="truncate text-xs">{output.label}</span>
      <TypeForAssistiveTech dataType={dataType} />
      <PortTypeLabel dataType={dataType} />
      <PortHandle portId={output.id} side="output" dataType={dataType} />
    </li>
  )
}

function PortGroupList({ group, data }: { group: PortGroup; data: FlowNodeData }) {
  if (group.inputs.length === 0) return null
  return (
    <section aria-label={group.title ?? undefined}>
      {group.title !== null && (
        <h3 className="px-3 pt-2 pb-0.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          {group.title}
        </h3>
      )}
      <ul>
        {group.inputs.map((input) => (
          <InputRow key={input.id} data={data} input={input} />
        ))}
      </ul>
    </section>
  )
}

/** A graph node: header, outputs on the right, inputs (with inline fields) on the left. */
function NodeViewComponent({ data, selected }: NodeProps<FlowNode>) {
  const { definition, node, outputTypes, error } = data
  const title = nodeTitle(node, definition)
  const isMaster = node.id === MASTER_NODE_ID

  return (
    <div
      data-error={error !== undefined}
      className={cn(
        'graph-node flex flex-col border bg-card text-card-foreground',
        isMaster ? 'w-64' : 'w-56',
        selected && 'border-primary shadow-[0_0_0_1px_var(--primary)]',
        error !== undefined && 'border-destructive',
      )}
    >
      <header className="flex h-8 items-center border-b bg-muted/50 px-3">
        <Tooltip delayDuration={DESCRIPTION_DELAY_MS}>
          <TooltipTrigger asChild>
            <h2 className="truncate font-heading text-xs font-semibold tracking-wide uppercase">
              {title}
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
      {definition.outputs.length > 0 && (
        <ul className="py-1">
          {definition.outputs.map((output) => {
            const dataType = outputTypes[output.id]
            return dataType === undefined ? null : (
              <OutputRow key={output.id} output={output} dataType={dataType} />
            )
          })}
        </ul>
      )}
      {definition.inputs.length > 0 && (
        <div className={cn('pb-1', definition.outputs.length > 0 && 'border-t pt-1')}>
          {inputGroups(data).map((group) => (
            <PortGroupList key={group.title ?? 'inputs'} group={group} data={data} />
          ))}
        </div>
      )}
      {error !== undefined && (
        <p className="flex items-start gap-1.5 border-t border-destructive px-3 py-2 text-xs text-destructive">
          <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

export const NodeView = memo(NodeViewComponent)
