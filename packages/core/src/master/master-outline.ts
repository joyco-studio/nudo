import type { TslFacade } from '../types/tsl-facade'
import type { MasterSettings, MasterSlots, MaterialAssignment } from './master-settings'

/** The master's boolean param that switches the outline pass on. */
export const OUTLINE_PARAM = 'outline'

/** What a facade needs to push each vertex out along its normal, wobbled by a drifting noise. */
type OutlineFacade<E> = Pick<
  TslFacade<E>,
  'add' | 'mul' | 'div' | 'max' | 'noise' | 'builtin' | 'construct'
>

/** A negative thickness would pull the hull inside the surface, where it never shows. */
const MIN_OUTLINE_THICKNESS = 0

/**
 * How many noise cells the wobble crosses per scene unit: about four bumps across the 2-unit
 * sphere, so the line swells and thins in a few places instead of fizzing.
 */
export const OUTLINE_WOBBLE_FREQUENCY = 4

/** How fast the wobble's noise drifts, in noise cells per second: a hand-drawn line's boil. */
export const OUTLINE_WOBBLE_SPEED = 2

/**
 * Where each vertex samples the wobble's noise: its object-space position in scene units (times
 * the object's scale, so a fitted model wobbles like the sphere), drifting with time.
 */
function wobblePoint<E>(tsl: OutlineFacade<E>): E {
  const scenePosition = tsl.mul(tsl.builtin('positionLocal'), tsl.builtin('modelScale'))
  return tsl.add(
    tsl.mul(scenePosition, tsl.construct('float', [OUTLINE_WOBBLE_FREQUENCY])),
    tsl.mul(tsl.builtin('time'), tsl.construct('float', [OUTLINE_WOBBLE_SPEED])),
  )
}

/** The line's thickness at each vertex: the width, plus or minus up to `wobble` of noise. */
function thickness<E>(tsl: OutlineFacade<E>, width: E, wobble: E): E {
  return tsl.add(width, tsl.mul(wobble, tsl.noise('perlin', wobblePoint(tsl))))
}

/**
 * How far each vertex of the hull moves, in object space: along its normal by the thickness
 * (never below 0), divided by the object's world scale so the outline is that many scene units
 * thick however the mesh is scaled (a fitted model or Suzanne gets the sphere's outline).
 */
function hullOffset<E>(tsl: OutlineFacade<E>, width: E, wobble: E): E {
  const clamped = tsl.max(
    thickness(tsl, width, wobble),
    tsl.construct('float', [MIN_OUTLINE_THICKNESS]),
  )
  return tsl.div(tsl.mul(tsl.builtin('normalLocal'), clamped), tsl.builtin('modelScale'))
}

/**
 * With an alpha clip wired, the hull is cut by the same mask, so the parts of the surface the clip
 * removes leave no ink behind. It stays opaque either way: only the cut, never the blend, carries.
 */
function alphaClipAssignments<E>(slots: MasterSlots<E>): readonly MaterialAssignment<E>[] {
  const { opacity, alphaClip } = slots
  if (opacity === undefined || alphaClip === undefined) return []
  return [
    { property: 'opacityNode', expression: opacity },
    { property: 'alphaTestNode', expression: alphaClip },
  ]
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
  const { outlineWidth, outlineColor, outlineWobble } = slots
  if (
    !settings.outline ||
    outlineWidth === undefined ||
    outlineColor === undefined ||
    outlineWobble === undefined
  ) {
    return []
  }
  const surfacePosition = slots.position ?? tsl.builtin('positionLocal')
  return [
    {
      property: 'positionNode',
      expression: tsl.add(surfacePosition, hullOffset(tsl, outlineWidth, outlineWobble)),
    },
    { property: 'colorNode', expression: outlineColor },
    ...alphaClipAssignments(slots),
  ]
}
