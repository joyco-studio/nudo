import {
  MathUtils,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  SphereGeometry,
} from 'three'
import type { BufferGeometry, Camera } from 'three'

import type { PreviewShape } from './preview-graph'

/** The geometry a preview material is drawn on, and the camera that frames it edge to edge. */
export interface PreviewStage {
  readonly geometry: BufferGeometry
  readonly camera: Camera
}

export type PreviewStages = Readonly<Record<PreviewShape, PreviewStage>> & { dispose(): void }

/** The quad spans clip space exactly: UV 0..1 covers the whole canvas. */
const QUAD_SIZE = 2
const NEAR = 0.1
const FAR = 10
const SPHERE_RADIUS = 1
const SPHERE_WIDTH_SEGMENTS = 48
const SPHERE_HEIGHT_SEGMENTS = 32
const SPHERE_CAMERA_DISTANCE = 3
/**
 * The camera frames a slightly larger sphere, so the silhouette's antialiased rim stays inside the
 * round mask the canvas is drawn with.
 */
const SPHERE_FRAMING_MARGIN = 1.04

/** Vertical field of view that fits a sphere of `radius` exactly, seen from `distance`. */
const fittingFov = (radius: number, distance: number): number =>
  MathUtils.radToDeg(2 * Math.asin(radius / distance))

function quadStage(): PreviewStage {
  const camera = new OrthographicCamera(-1, 1, 1, -1, NEAR, FAR)
  camera.position.set(0, 0, 1)
  return { geometry: new PlaneGeometry(QUAD_SIZE, QUAD_SIZE), camera }
}

function sphereStage(): PreviewStage {
  const fov = fittingFov(SPHERE_RADIUS * SPHERE_FRAMING_MARGIN, SPHERE_CAMERA_DISTANCE)
  const camera = new PerspectiveCamera(fov, 1, NEAR, FAR)
  camera.position.set(0, 0, SPHERE_CAMERA_DISTANCE)
  camera.lookAt(0, 0, 0)
  const geometry = new SphereGeometry(SPHERE_RADIUS, SPHERE_WIDTH_SEGMENTS, SPHERE_HEIGHT_SEGMENTS)
  return { geometry, camera }
}

/** One quad and one sphere, shared by every preview: only the material differs per node. */
export function createPreviewStages(): PreviewStages {
  const stages = { '2d': quadStage(), '3d': sphereStage() }
  return {
    ...stages,
    dispose() {
      stages['2d'].geometry.dispose()
      stages['3d'].geometry.dispose()
    },
  }
}
