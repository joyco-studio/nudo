import type { ParamValue } from '@nudo-tsl/core'

export interface EnumOption<V extends string> {
  readonly value: V
  readonly label: string
}

/** The option the stored param names, or `fallback` when it is missing or not an option. */
export function resolveEnumParam<V extends string>(
  options: readonly EnumOption<V>[],
  stored: ParamValue | undefined,
  fallback: V,
): V {
  return options.find((option) => option.value === stored)?.value ?? fallback
}
