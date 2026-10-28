import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, RefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import { RotateCcw, Upload, ZoomIn, ZoomOut } from 'lucide-react'
import type { Group } from 'three'
import type { RuntimeMaterial } from '@nudo-tsl/runtime'

import { effectivePreviewLayout } from '@/features/panels/panel-state'
import type { PreviewBackdrop } from '@/features/panels/panel-state'
import { cn } from '@/shared/lib/utils'
import { useEditorStore } from '@/store/editor-store'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { plural } from '@/i18n/translate'
import type { Translate } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'

import { BackdropField } from './backdrop-field'
import { BackgroundColorField, useBackgroundColor } from './background-color-field'
import { createRenderer } from './create-renderer'
import type { RendererBackend } from './create-renderer'
import { disposeModel, loadGlbModel } from './glb-model'
import { ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR, zoomView } from './orbit-view'
import type { OrbitView } from './orbit-view'
import { PreviewErrorBoundary } from './preview-error-boundary'
import { PreviewScene } from './preview-scene'
import { DEFAULT_SHAPE, PRIMITIVE_SHAPES, isPreviewShape, shapeLabelKey } from './preview-shape'
import type { PreviewShape } from './preview-shape'
import { RendererUnavailableError } from './renderer-unavailable-error'
import { useLiveMaterial } from './use-live-material'

const BACKEND_LABELS: Readonly<Record<RendererBackend, string>> = {
  webgpu: 'WebGPU',
  webgl2: 'WebGL2',
}
const CAMERA = { position: [0, 0, 3.6], fov: 40 } as const
const MAX_PIXEL_RATIO = 2
const MODEL_FILE_TYPES = '.glb,.gltf,model/gltf-binary,model/gltf+json'

const STATUS_CLASS = 'border-t px-3 py-2 text-xs text-muted-foreground'

interface ViewportProps {
  candidate: RuntimeMaterial | null
  shape: PreviewShape
  model: Group | null
  backgroundColor: string
  backdrop: PreviewBackdrop
  orbitRef: RefObject<OrbitView | null>
  onBackend: (backend: RendererBackend) => void
  onMaterialStatus: (rejection: string | null) => void
}

/** The R3F canvas, which owns the renderer's whole lifetime. */
function Viewport({ onBackend, ...scene }: ViewportProps) {
  const t = useT()
  const canvasLabel = t('preview.canvas')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // The renderer's canvas is created once; its name follows the UI language.
  useEffect(() => {
    canvasRef.current?.setAttribute('aria-label', canvasLabel)
  }, [canvasLabel])

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
        gl.domElement.setAttribute('aria-label', canvasLabel)
        canvasRef.current = gl.domElement
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
  const t = useT()
  const shapes: readonly PreviewShape[] = hasModel
    ? [...PRIMITIVE_SHAPES, 'model']
    : PRIMITIVE_SHAPES

  return (
    <ToggleGroup
      type="single"
      size="sm"
      spacing={1}
      aria-label={t('preview.mesh')}
      value={shape}
      onValueChange={(next) => {
        // Pressing the chosen item again would clear the group; a mesh is always chosen.
        if (isPreviewShape(next)) onShapeChange(next)
      }}
      className="grid w-full grid-cols-3"
    >
      {shapes.map((item) => (
        <ToggleGroupItem
          key={item}
          value={item}
          onFocus={() => {
            onShapeChange(item)
          }}
          className={cn(
            'px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground aria-checked:bg-primary aria-checked:text-primary-foreground',
            // The loaded file gets its own row so the built-in shapes keep a full grid.
            item === 'model' && 'col-span-full',
          )}
        >
          {t(shapeLabelKey(item))}
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
  const t = useT()

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
        if (!isStillWanted(loadId)) return
        // The cause goes to the console for debugging; the message says what to do next.
        console.warn(`Could not load ${file.name}:`, error)
        onError(t('preview.loadFailed', { file: file.name }))
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
        {t('preview.loadModel')}
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
  const backgroundColor = useBackgroundColor()
  const backdrop = useEditorStore((state) => state.panels.backdrop)
  // Docked, the viewport is a square; split and full give it all the height the panel has.
  const isFilling = useEditorStore((state) => effectivePreviewLayout(state.panels) !== 'docked')
  const orbitRef = useRef<OrbitView | null>(null)
  const t = useT()

  useEffect(() => {
    if (model === null) return
    return () => {
      disposeModel(model)
    }
  }, [model])

  // A rejection belongs to the newest material; once a later build failed it is out of date.
  const statusMessage = loadError ?? statusFor(buildFailed ? null : rejection, errorCount, t)

  const selectShape = (next: PreviewShape): void => {
    setLoadError(null)
    setShape(next)
  }

  return (
    <div className={cn('flex flex-col', isFilling && 'min-h-0 flex-1')}>
      {/*
       * min-h-0 matters when docked: an aspect-ratio box grows to its content's min-content height,
       * and R3F leaves the last (split or full) height inline on the canvas, which would keep the
       * square stretched until a reload.
       */}
      <div className={cn('relative min-h-0', isFilling ? 'flex-1' : 'aspect-square')}>
        <Viewport
          candidate={candidate}
          shape={shape}
          model={model}
          backgroundColor={backgroundColor.shown}
          backdrop={backdrop}
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
        {/* Wraps on a narrow column so the zoom buttons never fall off its edge. */}
        <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-2">
          <div className="flex items-center gap-1.5">
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
              {t('preview.resetView')}
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              static
              variant="ghost"
              size="icon-sm"
              aria-label={t('preview.zoomOut')}
              onClick={() => {
                if (orbitRef.current !== null) zoomView(orbitRef.current, ZOOM_OUT_FACTOR)
              }}
            >
              <ZoomOut aria-hidden="true" />
            </Button>
            <Button
              static
              variant="ghost"
              size="icon-sm"
              aria-label={t('preview.zoomIn')}
              onClick={() => {
                if (orbitRef.current !== null) zoomView(orbitRef.current, ZOOM_IN_FACTOR)
              }}
            >
              <ZoomIn aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <BackdropField />
          <BackgroundColorField color={backgroundColor} />
        </div>
      </div>
      {/* The live region stays mounted so a message that appears later is announced. */}
      <div aria-live="polite">
        {statusMessage !== '' && <p className={STATUS_CLASS}>{statusMessage}</p>}
      </div>
    </div>
  )
}

/** The status line under the preview. A compiler's own reason stays as three.js wrote it. */
function statusFor(rejection: string | null, errorCount: number, t: Translate): string {
  if (rejection !== null) return t('preview.rejected', { reason: rejection })
  if (errorCount === 0) return ''
  return t(plural(errorCount, { one: 'preview.errors.one', other: 'preview.errors.other' }), {
    count: errorCount,
  })
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
