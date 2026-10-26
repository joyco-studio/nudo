/** A plain decimal number with an optional exponent. Rejects hex, `Infinity`, lone signs and dots. */
const DECIMAL_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i
/** Steps are rounded to this many decimals so 0.1 + 0.2 reads as 0.3. */
const STEP_PRECISION = 1e6
const DISPLAY_DECIMALS = 3

/** Whether `raw` is a finite decimal number a field can store. */
export function isNumberInput(raw: string): boolean {
  const trimmed = raw.trim()
  return DECIMAL_PATTERN.test(trimmed) && Number.isFinite(Number(trimmed))
}

/** Parses what a person typed. Anything that is not a finite number keeps `previous`. */
export function parseNumberInput(raw: string, previous: number): number {
  return isNumberInput(raw) ? Number(raw.trim()) : previous
}

/** Adds `delta` to `value` without accumulating floating point noise. */
export function stepNumber(value: number, delta: number): number {
  return Math.round((value + delta) * STEP_PRECISION) / STEP_PRECISION
}

/** Short display text: at most three decimals and no trailing zeros. */
export function formatNumber(value: number): string {
  return String(Number(value.toFixed(DISPLAY_DECIMALS)))
}
