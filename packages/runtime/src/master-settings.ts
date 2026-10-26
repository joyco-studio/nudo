import { MASTER_NODE_ID } from '@nudo-tsl/core'
import type { Graph } from '@nudo-tsl/core'

export type MasterLighting = 'standard' | 'unlit'
export type MasterSurface = 'auto' | 'opaque' | 'transparent'

export interface MasterSettings {
  readonly lighting: MasterLighting
  readonly surface: MasterSurface
  readonly twoSided: boolean
}

export const DEFAULT_MASTER_SETTINGS: MasterSettings = {
  lighting: 'standard',
  surface: 'auto',
  twoSided: false,
}

const LIGHTING_VALUES: readonly MasterLighting[] = ['standard', 'unlit']
const SURFACE_VALUES: readonly MasterSurface[] = ['auto', 'opaque', 'transparent']

const pickOption = <V extends string>(options: readonly V[], stored: unknown, fallback: V): V =>
  options.find((option) => option === stored) ?? fallback

/** The master stack's lighting, surface and two-sided params, defaulting what is not stored. */
export function readMasterSettings(graph: Graph): MasterSettings {
  const params = graph.nodes[MASTER_NODE_ID]?.params
  if (params === undefined) return DEFAULT_MASTER_SETTINGS
  return {
    lighting: pickOption(LIGHTING_VALUES, params.lighting, DEFAULT_MASTER_SETTINGS.lighting),
    surface: pickOption(SURFACE_VALUES, params.surface, DEFAULT_MASTER_SETTINGS.surface),
    twoSided: params.twoSided === true,
  }
}
