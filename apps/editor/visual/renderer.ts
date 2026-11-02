import { parseGraph } from '@nudo-tsl/core'
import { createDefaultRegistry } from '@nudo-tsl/nodes'
import { createMaterial } from '@nudo-tsl/runtime'
import {
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
} from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { time, deltaTime } from 'three/tsl'

import {
  createPrimitiveGeometry,
  createHullGeometry,
} from '../src/features/main-preview/primitive-geometry'
import { KEY_LIGHT_INTENSITY, KEY_LIGHT_POSITION } from '../src/features/main-preview/key-light'
import { PREVIEW_CAMERA } from '../src/features/main-preview/preview-gl'
import inkSwirl from '../src/examples/ink-swirl.graph.json?raw'
import pencil from '../src/examples/pencil.graph.json?raw'
import poster from '../src/examples/poster.graph.json?raw'

const fixtures: Readonly<Record<string, string>> = { 'ink-swirl': inkSwirl, pencil, poster }
const canvas = document.querySelector('canvas')
if (canvas === null) throw new Error('Missing fixture canvas')
canvas.dataset.status = 'loading'

async function render(canvas: HTMLCanvasElement): Promise<void> {
  const name = new URLSearchParams(location.search).get('scene') ?? ''
  const raw = fixtures[name]
  if (raw === undefined) throw new Error(`Unknown visual fixture: ${name}`)
  const registry = createDefaultRegistry()
  const parsed = parseGraph(raw, registry)
  if (!parsed.ok) throw new Error('Invalid fixture graph')
  const build = createMaterial(parsed.value, registry)
  if (build.material === null || build.errors.length > 0 || build.missingTextures.length > 0) {
    throw new Error(
      `Fixture build failed: ${JSON.stringify(build.errors)}; missing textures: ${build.missingTextures.join(', ')}`,
    )
  }
  // The fixture owns the renderer and time nodes in this isolated page. No animation loop or
  // editor thumbnails contend for CPU. A fixed time makes future animated fixtures repeatable.
  time.onRenderUpdate(() => 0)
  deltaTime.onRenderUpdate(() => 0)
  const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL: true })
  renderer.setPixelRatio(1)
  renderer.setSize(400, 250)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = NoToneMapping
  renderer.toneMappingExposure = 1
  await renderer.init()
  const scene = new Scene()
  scene.background = new Color('#202025')
  const camera = new PerspectiveCamera(PREVIEW_CAMERA.fov, 400 / 250, 0.1, 100)
  camera.position.set(...PREVIEW_CAMERA.position)
  camera.lookAt(0, 0, 0)
  scene.add(new HemisphereLight('#ffffff', '#6b6b6b', 1.2))
  const key = new DirectionalLight('#ffffff', KEY_LIGHT_INTENSITY)
  key.position.set(...KEY_LIGHT_POSITION)
  scene.add(key)
  const geometry = createPrimitiveGeometry('sphere')
  scene.add(new Mesh(geometry, build.material))
  if (build.outline !== null) scene.add(new Mesh(createHullGeometry(geometry), build.outline))
  // Do not treat contrast, a delay, or a compiler debounce flag as renderer readiness.
  // Await actual shader compilation and the completed render submission, then capture once.
  await renderer.compileAsync(scene, camera)
  renderer.render(scene, camera)
  canvas.dataset.status = 'ready'
  canvas.dataset.backend = 'webgl2'
}

void render(canvas).catch((error: unknown) => {
  canvas.dataset.status = 'error'
  canvas.dataset.error = error instanceof Error ? error.message : String(error)
  console.error(error)
})
