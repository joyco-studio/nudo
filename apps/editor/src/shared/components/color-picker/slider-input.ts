/** A slider's range in whole units (percent, degrees). */
export interface SliderRange {
  readonly min: number
  readonly max: number
  readonly step: number
  readonly largeStep: number
}

const clampTo = (value: number, { min, max }: SliderRange): number =>
  Math.min(max, Math.max(min, value))

/**
 * Where a key press moves a slider (WAI-ARIA slider pattern): arrows step, Shift+arrows and Page
 * Up/Down take the large step, Home and End go to the ends. Null for any other key.
 */
export function valueForKey(
  key: string,
  isLarge: boolean,
  current: number,
  range: SliderRange,
): number | null {
  const base = Math.round(current)
  const arrowStep = isLarge ? range.largeStep : range.step
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return clampTo(base + arrowStep, range)
    case 'ArrowLeft':
    case 'ArrowDown':
      return clampTo(base - arrowStep, range)
    case 'PageUp':
      return clampTo(base + range.largeStep, range)
    case 'PageDown':
      return clampTo(base - range.largeStep, range)
    case 'Home':
      return range.min
    case 'End':
      return range.max
    default:
      return null
  }
}

/** Which axis of a 2D area a key moves: Left/Right/Home/End move x, Up/Down/Page keys move y. */
export function areaAxisForKey(key: string): 'x' | 'y' | null {
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'Home':
    case 'End':
      return 'x'
    case 'ArrowUp':
    case 'ArrowDown':
    case 'PageUp':
    case 'PageDown':
      return 'y'
    default:
      return null
  }
}

/** A pointer position as 0..1 along a track that starts at `start` and is `length` long. */
export function fractionAlong(position: number, start: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(1, Math.max(0, (position - start) / length))
}
