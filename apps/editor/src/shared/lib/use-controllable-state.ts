import { useCallback, useState } from 'react'

export interface ControllableStateOptions<T> {
  /** Controlled value; leave undefined to let the component keep its own. */
  value: T | undefined
  defaultValue: T
  onChange?: ((value: T) => void) | undefined
}

/**
 * A Radix-style value that is controlled or not. Components that animate a Radix primitive need
 * the value themselves instead of leaving it to Radix.
 */
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: ControllableStateOptions<T>): [value: T, setValue: (value: T) => void] {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue)
  const isControlled = value !== undefined
  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) setUncontrolledValue(next)
      onChange?.(next)
    },
    [isControlled, onChange],
  )
  return [value ?? uncontrolledValue, setValue]
}
