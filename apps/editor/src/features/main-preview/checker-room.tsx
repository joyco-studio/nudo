import { DataTexture, NearestFilter, RepeatWrapping, RGBAFormat, SRGBColorSpace } from 'three'

import { checkerPixels } from './checker-pixels'
import type { Rgb } from './checker-pixels'

/** Two mid greys: the pattern reads on both themes and never outshines the material. */
const LIGHT_CELL: Rgb = [150, 150, 150]
const DARK_CELL: Rgb = [92, 92, 92]
const PATTERN_SIZE = 2
/** One checker cell per world unit; the room is sized so the mesh (radius ~1) sits inside it. */
const ROOM_WIDTH = 12
const ROOM_DEPTH = 12
const WALL_HEIGHT = 7
const FLOOR_Y = -1.25
const WALL_Z = -3
const SURFACE_ROUGHNESS = 0.9

function createCheckerTexture(repeatX: number, repeatY: number): DataTexture {
  const texture = new DataTexture(
    checkerPixels(PATTERN_SIZE, LIGHT_CELL, DARK_CELL),
    PATTERN_SIZE,
    PATTERN_SIZE,
    RGBAFormat,
  )
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  // The pattern is 2 × 2 cells, so half as many repeats as cells.
  texture.repeat.set(repeatX / PATTERN_SIZE, repeatY / PATTERN_SIZE)
  texture.needsUpdate = true
  return texture
}

interface RoomTextures {
  readonly floor: DataTexture
  readonly wall: DataTexture
}

let roomTextures: RoomTextures | null = null

/**
 * Two tiny textures shared by every mount for the app's lifetime (a renderer re-uploads them when
 * it is recreated), so toggling the backdrop never leaks or disposes one still in use.
 */
function getRoomTextures(): RoomTextures {
  roomTextures ??= {
    floor: createCheckerTexture(ROOM_WIDTH, ROOM_DEPTH),
    wall: createCheckerTexture(ROOM_WIDTH, WALL_HEIGHT),
  }
  return roomTextures
}

/**
 * The "Checker room" backdrop: a floor and a back wall behind the mesh, so screen-space nodes
 * (Scene Color, Depth Fade) have something opaque to sample.
 */
export function CheckerRoom() {
  const { floor: floorTexture, wall: wallTexture } = getRoomTextures()

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y, WALL_Z + ROOM_DEPTH / 2]}>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial map={floorTexture} roughness={SURFACE_ROUGHNESS} />
      </mesh>
      <mesh position={[0, FLOOR_Y + WALL_HEIGHT / 2, WALL_Z]}>
        <planeGeometry args={[ROOM_WIDTH, WALL_HEIGHT]} />
        <meshStandardMaterial map={wallTexture} roughness={SURFACE_ROUGHNESS} />
      </mesh>
    </group>
  )
}
