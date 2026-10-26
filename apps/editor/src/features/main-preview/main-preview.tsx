import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent, RefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import { RotateCcw, Upload, ZoomIn, ZoomOut } from 'lucide-react'
import type { Group } from 'three'
import type { RuntimeMaterial } from '@nudo-tsl/runtime'

import { useEditorStore } from '@/store/editor-store'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { createRenderer } from './create-renderer'
import type { RendererBackend } from './create-renderer'
import { disposeModel, loadGlbModel } from './glb-model'
import { ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR, zoomView } from './orbit-view'
import type { OrbitView } from './orbit-view'
import { PreviewErrorBoundary } from './preview-error-boundary'
import { PreviewScene } from './preview-scene'
import { DEFAULT_SHAPE, PRIMITIVE_SHAPES, SHAPE_LABELS, isPreviewShape } from './preview-shape'
import type { PreviewShape } from './preview-shape'
import { RendererUnavailableError } from './renderer-unavailable-error'
import { getThemeBackgroundHex, subscribeToThemeBackground } from './theme-background'
import { useLiveMaterial } from './use-live-material'

const BACKEND_LABELS: Readonly<Record<RendererBackend, string>> = {
  webgpu: 'WebGPU',
  webgl2: 'WebGL2',
}
const CAMERA = { position: [0, 0, 3.6], fov: 40 } as const
const MAX_PIXEL_RATIO = 2
const MODEL_FILE_TYPES = '.glb,.gltf,model/gltf-binary,model/gltf+json'
const CANVAS_LABEL =
  'Material preview. Arrow keys pan the view; hold Shift with the arrow keys to rotate it.'

const STATUS_CLASS = 'border-t px-3 py-2 text-xs text-muted-foreground'

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

interface ViewportProps {
  candidate: RuntimeMaterial | null
  shape: PreviewShape
  model: Group | null
  backgroundColor: string
  orbitRef: RefObject<OrbitView | null>
  onBackend: (backend: RendererBackend) => void
  onMaterialStatus: (rejection: string | null) => void
}

/** The R3F canvas, which owns the renderer's whole lifetime. */
function Viewport({ onBackend, ...scene }: ViewportProps) {
  // R3F calls the factory once per root, so a new function identity never creates a renderer.
  const createGl = useCallback(
    async ({ canvas }: { canvas: HTMLCanvasElement | EventTarget }) => {
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new RendererUnavailableError('The preview needs an HTML canvas element.')
      }
      const result = await createRenderer(canvas)
      if (!result.ok) throw new RendererUnavailableError(result.message)
      onBackend(result.backend)
      return result.renderer
    },
    [onBackend],
  )

  return (
    <Canvas
      flat
      gl={createGl}
      camera={CAMERA}
      dpr={[1, MAX_PIXEL_RATIO]}
      onCreated={({ gl }) => {
        // Keyboard users orbit the view from the canvas itself, so it takes focus.
        gl.domElement.tabIndex = 0
        gl.domElement.dataset.focusRing = 'inset'
        gl.domElement.setAttribute('aria-label', CANVAS_LABEL)
      }}
    >
      <PreviewScene {...scene} />
    </Canvas>
  )
}

interface MeshPickerProps {
  shape: PreviewShape
  hasModel: boolean
  onShapeChange: (shape: PreviewShape) => void
}

/** Radio group: arrow keys move focus and choose the mesh in one step. */
function MeshPicker({ shape, hasModel, onShapeChange }: MeshPickerProps) {
  const shapes: readonly PreviewShape[] = hasModel
    ? [...PRIMITIVE_SHAPES, 'model']
    : PRIMITIVE_SHAPES

  return (
    <ToggleGroup
      type="single"
      size="sm"
      spacing={1}
      aria-label="Preview mesh"
      value={shape}
      onValueChange={(next) => {
        // Pressing the chosen item again would clear the group; a mesh is always chosen.
        if (isPreviewShape(next)) onShapeChange(next)
      }}
      className="w-full"
    >
      {shapes.map((item) => (
        <ToggleGroupItem
          key={item}
          value={item}
          onFocus={() => {
            onShapeChange(item)
          }}
          className="flex-1 px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {SHAPE_LABELS[item]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

interface LoadModelButtonProps {
  onModelLoaded: (model: Group) => void
  onError: (message: string | null) => void
}

function LoadModelButton({ onModelLoaded, onError }: LoadModelButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isMountedRef = useRef(false)
  const latestLoadRef = useRef(0)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  /** A load result is only used while the button is mounted and no newer load has started. */
  const isStillWanted = (loadId: number): boolean =>
    isMountedRef.current && latestLoadRef.current === loadId

  const loadPickedFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.currentTarget
    const [file] = input.files ?? []
    // Cleared so picking the same file again still fires `change`.
    input.value = ''
    if (file === undefined) return
    onError(null)
    latestLoadRef.current += 1
    const loadId = latestLoadRef.current
    loadGlbModel(file).then(
      (model) => {
        if (isStillWanted(loadId)) onModelLoaded(model)
        else disposeModel(model)
      },
      (error: unknown) => {
        if (isStillWanted(loadId)) onError(`Could not load ${file.name}: ${describeError(error)}`)
      },
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 px-3 has-[>svg]:px-3"
        onClick={() => {
          inputRef.current?.click()
        }}
      >
        <Upload aria-hidden="true" />
        Load GLB
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={MODEL_FILE_TYPES}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={loadPickedFile}
      />
    </>
  )
}

interface BackgroundColorFieldProps {
  value: string
  onChange: (hex: string) => void
}

function BackgroundColorField({ value, onChange }: BackgroundColorFieldProps) {
  const inputId = useId()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={inputId} className="text-xs text-muted-foreground">
        Background
      </label>
      <input
        id={inputId}
        type="color"
        aria-label="Background color"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        className="size-6 shrink-0 cursor-pointer border border-border bg-transparent p-0 [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
      />
    </div>
  )
}

/** The theme's background, until the user picks their own color. */
function useBackgroundColor() {
  const themeColor = useSyncExternalStore(subscribeToThemeBackground, getThemeBackgroundHex)
  const [customColor, setCustomColor] = useState<string | null>(null)
  return { backgroundColor: customColor ?? themeColor, setCustomColor }
}

interface PreviewWorkspaceProps {
  candidate: RuntimeMaterial | null
  buildFailed: boolean
  errorCount: number
}

function PreviewWorkspace({ candidate, buildFailed, errorCount }: PreviewWorkspaceProps) {
  const [shape, setShape] = useState<PreviewShape>(DEFAULT_SHAPE)
  const [model, setModel] = useState<Group | null>(null)
  const [backend, setBackend] = useState<RendererBackend | null>(null)
  const [rejection, setRejection] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { backgroundColor, setCustomColor } = useBackgroundColor()
  const orbitRef = useRef<OrbitView | null>(null)

  useEffect(() => {
    if (model === null) return
    return () => {
      disposeModel(model)
    }
  }, [model])

  // A rejection belongs to the newest material; once a later build failed it is out of date.
  const statusMessage = loadError ?? statusFor(buildFailed ? null : rejection, errorCount)

  const selectShape = (next: PreviewShape): void => {
    setLoadError(null)
    setShape(next)
  }

  return (
    <div className="flex flex-col">
      <div className="relative aspect-square">
        <Viewport
          candidate={candidate}
          shape={shape}
          model={model}
          backgroundColor={backgroundColor}
          orbitRef={orbitRef}
          onBackend={setBackend}
          onMaterialStatus={setRejection}
        />
        {backend !== null && (
          <Badge variant="secondary" className="absolute bottom-2 left-2 py-0 font-mono">
            {BACKEND_LABELS[backend]}
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t p-3">
        <MeshPicker shape={shape} hasModel={model !== null} onShapeChange={selectShape} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LoadModelButton
              onError={setLoadError}
              onModelLoaded={(loaded) => {
                setModel(loaded)
                selectShape('model')
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 px-3 has-[>svg]:px-3"
              onClick={() => {
                orbitRef.current?.reset()
              }}
            >
              <RotateCcw aria-hidden="true" />
              Reset view
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom out"
              onClick={() => {
                if (orbitRef.current !== null) zoomView(orbitRef.current, ZOOM_OUT_FACTOR)
              }}
            >
              <ZoomOut aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom in"
              onClick={() => {
                if (orbitRef.current !== null) zoomView(orbitRef.current, ZOOM_IN_FACTOR)
              }}
            >
              <ZoomIn aria-hidden="true" />
            </Button>
          </div>
        </div>
        <BackgroundColorField value={backgroundColor} onChange={setCustomColor} />
      </div>
      {/* The live region stays mounted so a message that appears later is announced. */}
      <div aria-live="polite">
        {statusMessage !== '' && <p className={STATUS_CLASS}>{statusMessage}</p>}
      </div>
    </div>
  )
}

function statusFor(rejection: string | null, errorCount: number): string {
  if (rejection !== null) {
    return `The newest material did not compile (${rejection}). Showing the last working one.`
  }
  if (errorCount === 0) return ''
  const subject =
    errorCount === 1 ? '1 node has an error' : `${String(errorCount)} nodes have errors`
  return `${subject}. Showing the last valid result.`
}

/** The live preview: compiles the editor graph and shows it on a mesh. */
export function MainPreview() {
  const { material: candidate, buildFailed } = useLiveMaterial()
  const errorCount = useEditorStore((state) => Object.keys(state.errorsByNode).length)

  return (
    <PreviewErrorBoundary>
      <PreviewWorkspace candidate={candidate} buildFailed={buildFailed} errorCount={errorCount} />
    </PreviewErrorBoundary>
  )
}
