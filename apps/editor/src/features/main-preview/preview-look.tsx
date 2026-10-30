import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping, NoToneMapping } from 'three'
import type { Scene, ToneMapping } from 'three'
import { ColorEnvironment } from 'three/addons/environments/ColorEnvironment.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { PMREMGenerator } from 'three/webgpu'
import type { WebGPURenderer } from 'three/webgpu'

import type { PreviewEnvironment, PreviewToneMapping } from '@/features/panels/panel-state'

/** What the preview's tone mapping choices are in three. */
export const TONE_MAPPINGS: Readonly<Record<PreviewToneMapping, ToneMapping>> = {
  none: NoToneMapping,
  aces: ACESFilmicToneMapping,
  agx: AgXToneMapping,
  neutral: NeutralToneMapping,
}

/** The neutral environment: an even mid grey all around, so reflections show shape, not a room. */
const NEUTRAL_ENVIRONMENT_COLOR = 0x9a9a9a
/** RoomEnvironment's own blur, as three's examples use it. */
const STUDIO_BLUR = 0.04
/**
 * Pixels per cube face of the prefiltered environment (three's default is 256). The studio blur
 * (0.04 rad, about 2.3°) already wipes out any detail finer than a 64 px face holds (1.4° per
 * texel), so the sharp level looks the same, and the blurred ones nearly so. At 256 the blur pass
 * over the full-size atlas costs seconds of CPU on every page with a software rasterizer
 * (SwiftShader, as in headless test browsers); at 64 it costs about nothing.
 */
const ENVIRONMENT_SIZE = 64
/** The cube camera's clip range for the environment scene: three's defaults, made explicit. */
const ENVIRONMENT_NEAR = 0.1
const ENVIRONMENT_FAR = 100
/**
 * How strongly the environment lights the mesh. The key light stays on top of it, so the studio
 * is turned down a little to keep a lit white near white instead of past it.
 */
const ENVIRONMENT_INTENSITY: Readonly<Record<Exclude<PreviewEnvironment, 'none'>, number>> = {
  studio: 0.5,
  neutral: 0.45,
}

/** A procedural scene for the environment: three's studio room, or one even color. */
function environmentScene(environment: Exclude<PreviewEnvironment, 'none'>): Scene {
  return environment === 'studio'
    ? new RoomEnvironment()
    : new ColorEnvironment(NEUTRAL_ENVIRONMENT_COLOR)
}

interface PreviewLookProps {
  readonly toneMapping: PreviewToneMapping
  readonly exposure: number
  readonly environment: PreviewEnvironment
}

/**
 * Applies the preview's look inside a `<Canvas>`: the renderer's tone mapping and exposure, and
 * the scene's image-based light, prefiltered once (PMREM) from a scene built at runtime, so no
 * HDR file ships with the editor. Unlit materials opt out of tone mapping themselves.
 */
export function PreviewLook({ toneMapping, exposure, environment }: PreviewLookProps) {
  // The renderer and scene are three objects the effects set up; read them there, not in render.
  const get = useThree((state) => state.get)

  useEffect(() => {
    const { gl, invalidate } = get()
    gl.toneMapping = TONE_MAPPINGS[toneMapping]
    gl.toneMappingExposure = exposure
    invalidate()
  }, [get, toneMapping, exposure])

  useEffect(() => {
    const { gl, scene, invalidate } = get()
    if (environment === 'none') {
      scene.environment = null
      invalidate()
      return
    }
    // R3F hands the renderer back as its own type; the preview always creates a WebGPURenderer.
    const renderer: unknown = gl
    if (!isWebGpuRenderer(renderer)) return
    const generator = new PMREMGenerator(renderer)
    const source = environmentScene(environment)
    const target = generator.fromScene(
      source,
      environment === 'studio' ? STUDIO_BLUR : 0,
      ENVIRONMENT_NEAR,
      ENVIRONMENT_FAR,
      { size: ENVIRONMENT_SIZE },
    )
    scene.environment = target.texture
    scene.environmentIntensity = ENVIRONMENT_INTENSITY[environment]
    invalidate()
    return () => {
      if (scene.environment === target.texture) scene.environment = null
      target.dispose()
      generator.dispose()
      disposeScene(source)
    }
  }, [get, environment])

  return null
}

function isWebGpuRenderer(value: unknown): value is WebGPURenderer {
  return typeof value === 'object' && value !== null && 'isWebGPURenderer' in value
}

/** Frees the geometries and materials of a procedural environment scene. */
function disposeScene(source: Scene): void {
  source.traverse((object) => {
    if ('geometry' in object && isDisposable(object.geometry)) object.geometry.dispose()
    if ('material' in object && isDisposable(object.material)) object.material.dispose()
  })
}

function isDisposable(value: unknown): value is { dispose: () => void } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dispose' in value &&
    typeof value.dispose === 'function'
  )
}
