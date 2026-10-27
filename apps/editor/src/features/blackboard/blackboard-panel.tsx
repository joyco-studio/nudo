import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/empty'

/** The Properties panel's body (code name: blackboard). Adding properties arrives in a later task. */
export function BlackboardPanel() {
  return (
    <Empty className="items-start gap-1 p-3 text-left">
      <EmptyHeader className="items-start gap-1">
        <EmptyTitle className="text-xs font-medium">No properties yet.</EmptyTitle>
        <EmptyDescription className="text-xs">
          Properties are named values you can reuse across the graph.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
