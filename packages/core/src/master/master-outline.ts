import type { TslFacade } from '../types/tsl-facade'
import type { MasterSettings, MasterSlots, MaterialAssignment } from './master-settings'

/** The master's boolean param that switches the outline pass on. */
export const OUTLINE_PARAM = 'outline'

/** What the outline needs from a facade: pushing each vertex out along its normal. */
type OutlineFacade<E> = Pick<TslFacade<E>, 'add' | 'mul' | 'div' | 'max' | 'builtin' | 'construct'>

/** A negative width would pull the hull inside the surface, where it never shows. */
const MIN_OUTLINE_WIDTH = 0

/**
 * How far each vertex of the hull moves, in object space: along its normal by the width, divided
 * by the object's world scale so the outline is `width` scene units thick however the mesh is
 * scaled (a fitted model or Suzanne gets the sphere's outline).
 */
function hullOffset<E>(tsl: OutlineFacade<E>, width: E): E {
  const clampedWidth = tsl.max(width, tsl.construct('float', [MIN_OUTLINE_WIDTH]))
  return tsl.div(tsl.mul(tsl.builtin('normalLocal'), clampedWidth), tsl.builtin('modelScale'))
}

/**
 * The material properties of the inverted-hull outline: the mesh drawn again, back faces only,
 * each vertex pushed out along its normal and filled with one flat color. It follows the master's
 * Position, so a displaced surface keeps its outline. Empty while the outline is off or its slots
 * did not compile.
 */
export function outlineMaterialAssignments<E>(
  tsl: OutlineFacade<E>,
  slots: MasterSlots<E>,
  settings: MasterSettings,
): readonly MaterialAssignment<E>[] {
  const { outlineWidth, outlineColor } = slots
  if (!settings.outline || outlineWidth === undefined || outlineColor === undefined) return []
  const surfacePosition = slots.position ?? tsl.builtin('positionLocal')
  return [
    {
      property: 'positionNode',
      expression: tsl.add(surfacePosition, hullOffset(tsl, outlineWidth)),
    },
    { property: 'colorNode', expression: outlineColor },
  ]
}
