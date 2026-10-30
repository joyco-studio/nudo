import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas } from '@react-three/fiber'
import { AnimatePresence, motion } from 'motion/react'
import { TriangleAlert } from 'lucide-react'

import type { Example, ExampleId } from '@/examples'
import type { OrbitView } from '@/features/main-preview/orbit-view'
import { PreviewErrorBoundary } from '@/features/main-preview/preview-error-boundary'
import {
  MAX_PREVIEW_PIXEL_RATIO,
  PREVIEW_CAMERA,
  startPreviewRenderer,
} from '@/features/main-preview/preview-gl'
import { usePreviewLook } from '@/features/main-preview/preview-look-fields'
import { PreviewScene } from '@/features/main-preview/preview-scene'
import {
  getThemeBackgroundHex,
  subscribeToThemeBackground,
} from '@/features/main-preview/theme-background'
import type { PreviewMaterials } from '@/features/main-preview/preview-materials'
import type { MaterialRejection } from '@/features/main-preview/validate-material'
import { useT } from '@/i18n/use-t'
import { useMotionMode } from '@/shared/motion/use-motion-preset'
import type { MotionMode } from '@/shared/motion/motion-presets'
import { BLUR_PX, DURATION_MS, EASE, toSeconds } from '@/shared/motion/tokens'

import { useTemplatePreview } from './use-template-preview'
import type { TemplatePreview as TemplatePreviewState } from './use-template-preview'

/** Reference 14 (skeleton loader): one pulse a second, down to half opacity. */
const SKELETON_PULSE_MS = 1000
const SKELETON_PULSE_MIN = 0.5

/**
 * What the viewport shows: the template drawn, still on its way, not drawable, or no preview at all
 * (no WebGPU or WebGL2, or the preview crashed: its error boundary says so).
 */
export type PreviewStatus = 'loading' | 'ready' | 'failed' | 'unavailable'

/** The last material the renderer took (or refused), and which template it belongs to. */
interface ShownMaterial {
  readonly id: ExampleId
  readonly isDrawn: boolean
}

function statusOf(
  exampleId: ExampleId,
  preview: TemplatePreviewState,
  shown: ShownMaterial | null,
): PreviewStatus {
  // Until the scheduler hears of a new selection, what it reports is about the last one.
  if (preview.status === 'idle' || preview.id !== exampleId) return 'loading'
  if (preview.status === 'failed') return 'failed'
  if (preview.status !== 'ready' || shown?.id !== preview.id) return 'loading'
  return shown.isDrawn ? 'ready' : 'failed'
}

interface HandOverProps {
  materials: PreviewMaterials | null
  onHandOver: (materials: PreviewMaterials) => void
}

/**
 * Inside the canvas, so its effect runs exactly when the scene's does: from then on the scene owns
 * the materials (it frees them once newer ones replace them, or on unmount) and the scheduler
 * doesn't.
 */
function HandOver({ materials, onHandOver }: HandOverProps) {
  useEffect(() => {
    if (materials !== null) onHandOver(materials)
  }, [materials, onHandOver])
  return null
}

/** The skeleton leaves with reference 14's cross-fade and blur; from the keyboard, at once. */
function revealTransition(mode: MotionMode) {
  if (mode === 'instant') return { opacity: 0, transition: { duration: 0 } }
  if (mode === 'reduced') {
    return { opacity: 0, transition: { duration: toSeconds(DURATION_MS.quick), ease: EASE.inOut } }
  }
  return {
    opacity: 0,
    filter: `blur(${String(BLUR_PX.small)}px)`,
    transition: { duration: toSeconds(DURATION_MS.slow), ease: EASE.inOut },
  }
}

function LoadingSkeleton({ label }: { label: string }) {
  const mode = useMotionMode()
  return (
    <motion.div
      key="loading"
      role="status"
      className="absolute inset-0 grid place-items-center bg-muted p-4"
      exit={revealTransition(mode)}
    >
      <motion.div
        aria-hidden="true"
        className="size-2/5 max-h-48 max-w-48 rounded-full bg-accent"
        animate={mode === 'full' ? { opacity: [1, SKELETON_PULSE_MIN, 1] } : { opacity: 1 }}
        transition={{
          duration: toSeconds(SKELETON_PULSE_MS),
          ease: EASE.linear,
          repeat: Number.POSITIVE_INFINITY,
        }}
      />
      <span className="sr-only">{label}</span>
    </motion.div>
  )
}

interface TemplatePreviewProps {
  example: Example
  title: string
}

/**
 * The selected template, compiled from its own graph and drawn live on the mesh it was made for,
 * over the grid. Orbitable like the Main Preview, with its own renderer: the canvas and every
 * material it built go away when the browser closes.
 */
export function TemplatePreview({ example, title }: TemplatePreviewProps) {
  const t = useT()
  const { preview, handOver } = useTemplatePreview(example.id)
  const [shown, setShown] = useState<ShownMaterial | null>(null)
  const [isUnavailable, setIsUnavailable] = useState(false)
  const backgroundColor = useSyncExternalStore(subscribeToThemeBackground, getThemeBackgroundHex)
  const orbitRef = useRef<OrbitView | null>(null)
  // The same look as the main preview, so a template opens looking as it was browsed.
  const look = usePreviewLook()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasLabel = t('templates.preview', { title })
  const status = isUnavailable ? 'unavailable' : statusOf(example.id, preview, shown)
  const candidate = preview.status === 'ready' ? preview.material : null

  useEffect(() => {
    canvasRef.current?.setAttribute('aria-label', canvasLabel)
  }, [canvasLabel])

  // Each template starts from the same view, whatever the last one was turned to.
  useEffect(() => {
    orbitRef.current?.reset()
  }, [example.id])

  // Validation only reports for the newest candidate, which is the ready template's.
  const onMaterialStatus = (rejection: MaterialRejection | null): void => {
    if (preview.status === 'ready') setShown({ id: preview.id, isDrawn: rejection === null })
  }

  const createGl = useCallback(
    async ({ canvas }: { canvas: HTMLCanvasElement | EventTarget }) =>
      (await startPreviewRenderer(canvas)).renderer,
    [],
  )

  return (
    <div
      data-template-preview
      data-status={status}
      data-shown-template={status === 'ready' ? shown?.id : undefined}
      className="relative size-full min-h-0 overflow-hidden"
    >
      <PreviewErrorBoundary
        fallbackClassName="size-full"
        onFailure={() => {
          setIsUnavailable(true)
        }}
      >
        <Canvas
          flat
          gl={createGl}
          camera={PREVIEW_CAMERA}
          dpr={[1, MAX_PREVIEW_PIXEL_RATIO]}
          onCreated={({ gl }) => {
            // Keyboard users orbit the view from the canvas itself, so it takes focus.
            gl.domElement.tabIndex = 0
            gl.domElement.dataset.focusRing = 'inset'
            gl.domElement.setAttribute('aria-label', canvasLabel)
            canvasRef.current = gl.domElement
          }}
        >
          <PreviewScene
            candidate={candidate}
            shape={example.previewShape}
            model={null}
            backgroundColor={backgroundColor}
            backdrop="grid"
            toneMapping={look.toneMapping}
            exposure={look.exposure}
            environment={look.environment}
            orbitRef={orbitRef}
            onMaterialStatus={onMaterialStatus}
          />
          <HandOver materials={candidate} onHandOver={handOver} />
        </Canvas>
      </PreviewErrorBoundary>
      <AnimatePresence initial={false}>
        {status === 'loading' && <LoadingSkeleton label={t('templates.compiling')} />}
      </AnimatePresence>
      {status === 'failed' && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted p-4 text-center text-xs text-muted-foreground"
        >
          <TriangleAlert aria-hidden="true" className="size-4 text-destructive" />
          <p className="max-w-64">{t('templates.failed', { title })}</p>
        </div>
      )}
    </div>
  )
}
