import { Bot } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

import { agentLookOf } from './agent-brand'
import { AGENT_BRAND_ICONS } from './agent-brand-icons'

/**
 * The logo of the client the agent runs in, or a generic bot for one nudo does not recognize.
 * Decorative: the agent's name is always written next to it.
 */
export function AgentBrandIcon({ name, className }: { name: string; className?: string }) {
  const { brand } = agentLookOf(name)
  if (brand === null) return <Bot aria-hidden="true" className={cn('shrink-0', className)} />
  const icon = AGENT_BRAND_ICONS[brand]
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-agent-brand={brand}
      viewBox={icon.viewBox}
      fill="currentColor"
      fillRule={icon.fillRule}
      className={cn('shrink-0', className)}
    >
      {icon.paths.map((path) => (
        <path key={path.d} d={path.d} clipRule={path.clipRule} />
      ))}
    </svg>
  )
}
