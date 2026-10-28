import { useEffect, useMemo } from 'react'
import {
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three/webgpu'
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
import type { FlatQuad } from './grid-floor-layout'

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

const QUARTER_TURN = Math.PI / 2
const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -QUARTER_TURN)
const UNIT_SCALE = new Vector3(1, 1, 1)
const ROLL_AXIS = new Vector3(0, 0, 1)

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

/** One instanced mesh of thin quads laid flat: planes, not lines, so WebGPU and WebGL2 agree. */
function createQuadMesh(
  geometry: PlaneGeometry,
  material: MeshBasicNodeMaterial,
  quads: readonly FlatQuad[],
  lift: number,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, quads.length)
  const matrix = new Matrix4()
  const position = new Vector3()
  const rotation = new Quaternion()
  quads.forEach((quad, index) => {
    rotation.setFromAxisAngle(ROLL_AXIS, quad.roll).premultiply(FLAT)
    matrix.compose(position.set(quad.x, lift, quad.z), rotation, UNIT_SCALE)
    mesh.setMatrixAt(index, matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

interface GridFloorParts {
  readonly group: Group
  readonly dispose: () => void
}

function createGridFloor(): GridFloorParts {
  const lineGeometry = new PlaneGeometry(GRID_SIZE, GRID_LINE_WIDTH)
  const crossGeometry = new PlaneGeometry(CROSS_LINE_WIDTH, CROSS_HEIGHT)
  const lineMaterial = createGridMaterial()
  const crossMaterial = createGridMaterial()
  const lines = createQuadMesh(lineGeometry, lineMaterial, gridLineQuads(), LINE_LIFT)
  const crosses = createQuadMesh(crossGeometry, crossMaterial, crossQuads(), CROSS_LIFT)
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
      for (const disposable of [lines, crosses, lineGeometry, crossGeometry]) disposable.dispose()
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
