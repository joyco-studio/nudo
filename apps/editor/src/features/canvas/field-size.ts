import { createContext, use } from 'react'

/**
 * How large node fields draw: `compact` fits a 28px port row on a canvas node, `comfortable` is
 * the Inspector's larger editor. The same components read it, so both stay one implementation.
 */
export type FieldSize = 'compact' | 'comfortable'

export const FieldSizeContext = createContext<FieldSize>('compact')

export function useFieldSize(): FieldSize {
  return use(FieldSizeContext)
}
