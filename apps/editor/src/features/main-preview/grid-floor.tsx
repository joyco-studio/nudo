import { useEffect, useMemo } from 'react'
import { Group, Mesh, MeshBasicNodeMaterial } from 'three/webgpu'
import { cameraPosition, color, distance, float, positionWorld, smoothstep } from 'three/tsl'

import { BACKDROP_FLOOR_Y } from './backdrop-floor'
import {
  CROSS_HEIGHT,
  CROSS_LINE_WIDTH,
  GRID_LINE_WIDTH,
  GRID_SIZE,
  crossQuads,
  gridLineQuads,
} from './grid-floor-layout'
import { createFlatQuadsGeometry } from './grid-floor-geometry'

const GRID_COLOR = '#bbbbbb'
/** A quiet backdrop: blended over the background it reads on both themes and on custom colors. */
const GRID_OPACITY = 0.28
/**
 * The reference fades from 9 to 33 units seen from its idle camera about 8 units out. Our camera
 * starts 3.6 units out, so both ends scale by ~0.45: the floor right below the mesh stays at full
 * strength and the grid is gone well before its lines would shimmer at the horizon.
 */
const FADE_NEAR = 4
const FADE_FAR = 15
/** The crosses float a hair above the lines, as in the reference, so the two never z-fight. */
const LINE_LIFT = -0.02
const CROSS_LIFT = -0.01
const LINES_RENDER_ORDER = 0
const CROSSES_RENDER_ORDER = 1

/**
 * Explicit color and opacity nodes (the reference found the classic opacity path unreliable
 * across backends). The fade lives in the grid's own opacity rather than `scene.fog`, which would
 * also tint the material being previewed: transparent pixels show the background color through.
 */
function createGridMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ depthWrite: false, transparent: true })
  const fade = float(1).sub(
    smoothstep(FADE_NEAR, FADE_FAR, distance(positionWorld, cameraPosition)),
  )
  material.colorNode = color(GRID_COLOR)
  material.opacityNode = float(GRID_OPACITY).mul(fade)
  return material
}

interface GridFloorParts {
  readonly group: Group
  readonly dispose: () => void
}

function createGridFloor(): GridFloorParts {
  const lineGeometry = createFlatQuadsGeometry(
    GRID_SIZE,
    GRID_LINE_WIDTH,
    gridLineQuads(),
    LINE_LIFT,
  )
  const crossGeometry = createFlatQuadsGeometry(
    CROSS_LINE_WIDTH,
    CROSS_HEIGHT,
    crossQuads(),
    CROSS_LIFT,
  )
  const lineMaterial = createGridMaterial()
  const crossMaterial = createGridMaterial()
  const lines = new Mesh(lineGeometry, lineMaterial)
  const crosses = new Mesh(crossGeometry, crossMaterial)
  lines.renderOrder = LINES_RENDER_ORDER
  crosses.renderOrder = CROSSES_RENDER_ORDER

  const group = new Group()
  group.name = 'grid-floor'
  group.position.y = BACKDROP_FLOOR_Y
  group.add(lines, crosses)

  return {
    group,
    // R3F detaches the group itself when the primitive unmounts; this frees only GPU resources.
    dispose: () => {
      lineGeometry.dispose()
      crossGeometry.dispose()
      lineMaterial.dispose()
      crossMaterial.dispose()
    },
  }
}

/**
 * The "Grid" backdrop: a quiet floor grid like joyco's gltf viewer, fading with distance into the
 * preview background. It adds no lights or environment, so material previews look the same.
 */
export function GridFloor() {
  const floor = useMemo(() => createGridFloor(), [])

  // Three.js re-uploads a disposed object on its next draw, so a Strict Mode remount is safe.
  useEffect(() => floor.dispose, [floor])

  return <primitive object={floor.group} />
}
