import type { NodeId } from '@nudo-tsl/core'

import { useT } from '@/i18n/use-t'
import { useEditorStore } from '@/store/editor-store'

import { creatorNameOf, editorNameOf } from './presence-model'

interface NodeAgentMarkProps {
  nodeId: NodeId
}

/**
 * "{name} · editing" above the node's top-left corner while the agent's cursor is on it. Decorative
 * like the rest of the presence: the live region announces what the agent does. The node frame
 * must be `relative`.
 */
export function AgentEditingTag({ nodeId }: NodeAgentMarkProps) {
  const t = useT()
  const name = useEditorStore((state) => editorNameOf(state, nodeId))
  if (name === null) return null
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-full left-0 mb-1 bg-agent px-1.5 text-micro font-medium whitespace-nowrap text-agent-foreground"
    >
      {t('agent.editing', { name })}
    </span>
  )
}

/** "by {name}" in the header of a node the current agent task created. */
export function AgentCreatedBadge({ nodeId }: NodeAgentMarkProps) {
  const t = useT()
  const name = useEditorStore((state) => creatorNameOf(state, nodeId))
  if (name === null) return null
  return (
    <span className="flex shrink-0 items-center gap-1 text-micro leading-6 font-medium text-agent">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-agent" />
      {t('agent.byAgent', { name })}
    </span>
  )
}
