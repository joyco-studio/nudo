import type { BlackboardProperty } from '@nudo-tsl/core'

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/empty'

import type { BlackboardActions } from './blackboard-actions'
import { focusTargetAfterDelete } from './property-focus'
import { PropertyRow } from './property-row'

export interface BlackboardPanelProps {
  properties: readonly BlackboardProperty[]
  actions: BlackboardActions
}

/** The Properties panel's body (code name: blackboard): one row per property, or how to start. */
export function BlackboardPanel({ properties, actions }: BlackboardPanelProps) {
  if (properties.length === 0) {
    return (
      <Empty className="items-start gap-1 p-3 text-left">
        <EmptyHeader className="items-start gap-1">
          <EmptyTitle className="text-xs font-medium">No properties yet.</EmptyTitle>
          <EmptyDescription className="text-xs">
            Add one with + to reuse a value across the graph and tweak it live.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ul>
      {properties.map((property) => (
        <PropertyRow
          key={property.id}
          property={property}
          actions={actions}
          onDelete={() => {
            const restoreFocus = focusTargetAfterDelete(property.id)
            actions.remove(property.id)
            requestAnimationFrame(restoreFocus)
          }}
        />
      ))}
    </ul>
  )
}
