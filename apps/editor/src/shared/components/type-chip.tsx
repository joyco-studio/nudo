interface TypeChipProps {
  /** The type as short text (`float`, `vec3`, `color`). */
  children: string
}

/** A property's type, in a small outlined chip: on its canvas node and in the Properties panel. */
export function TypeChip({ children }: TypeChipProps) {
  return (
    <span
      data-type-chip
      className="shrink-0 border px-1 font-mono text-micro leading-4 text-muted-foreground"
    >
      {children}
    </span>
  )
}
