import type { BuiltinName } from '@nudo-tsl/core'

const FALLBACK_LABELS: Readonly<Record<BuiltinName, string>> = {
  time: 'Time',
  deltaTime: 'Delta time',
  uv: 'Mesh UV',
  normalWorld: 'World normal',
  normalView: 'View normal',
  positionLocal: 'Local position',
  positionWorld: 'World position',
  positionViewDirection: 'View dir',
  positionView: 'View position',
  screenUV: 'Screen UV',
  cameraPosition: 'Camera position',
}

/** What an unconnected input with a builtin fallback reads from, shown instead of a value field. */
export const fallbackLabel = (fallback: BuiltinName): string => FALLBACK_LABELS[fallback]
