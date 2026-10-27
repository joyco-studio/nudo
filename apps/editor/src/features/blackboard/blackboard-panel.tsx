/** The Blackboard's body. Properties (named values shared across the graph) arrive in a later task. */
export function BlackboardPanel() {
  return (
    <div className="flex flex-col gap-1 p-3 text-xs">
      <p className="font-medium">No properties yet.</p>
      <p className="text-muted-foreground">
        Properties are named values you can reuse across the graph.
      </p>
    </div>
  )
}
