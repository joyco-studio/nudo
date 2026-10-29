import { useRef } from 'react'
import { LoaderCircle } from 'lucide-react'

import { findExample, listedExamples } from '@/examples'
import type { ExampleId } from '@/examples'
import { useT } from '@/i18n/use-t'
import { KeyHints } from '@/shared/components/key-hints'
import { htmlElementOf } from '@/shared/lib/html-element-of'
import { useMediaQuery } from '@/shared/lib/use-media-query'
import { cn } from '@/shared/lib/utils'
import type { KeyHint } from '@/shared/components/key-hints'
import { Button } from '@/shared/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet'

import { TemplateDetailsScroller } from './template-details'
import { TemplateList } from './template-list'
import { TemplatePreview } from './template-preview'

/** Tailwind's `md`: from here the list and the preview sit side by side. */
const WIDE_SHEET_QUERY = '(min-width: 48rem)'

const KEY_HINTS: readonly KeyHint[] = [
  { keys: '↑ ↓', action: 'keyHint.move' },
  { keys: 'Enter', action: 'keyHint.open' },
  { keys: 'Esc', action: 'keyHint.close' },
]

export interface TemplatesBrowserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedId: ExampleId
  onSelect: (id: ExampleId) => void
  /**
   * Opens the selected template. `returnFocusTo` gets focus back if the person then cancels the
   * confirmation that replacing their graph asks for.
   */
  onOpenTemplate: (returnFocusTo: HTMLElement | null) => void
  /** The chosen template is waiting for its textures: Open shows it is busy and does nothing. */
  isOpening: boolean
  /** Runs once the sheet has closed, in place of Radix's default, to put focus back. */
  onCloseAutoFocus: (event: Event) => void
}

/**
 * Swaps "Open template" for "Opening…" in place, so the button keeps its width. The swap waits a
 * moment: a template whose textures land at once never flashes the busy label.
 */
function OpenButtonLabel({ isOpening }: { isOpening: boolean }) {
  const t = useT()
  const swapAfterDelay = 'transition-[visibility] duration-0 delay-200'
  return (
    <span className="grid place-items-center">
      <span className={cn('col-start-1 row-start-1', isOpening && `invisible ${swapAfterDelay}`)}>
        {t('templates.open')}
      </span>
      <span
        className={cn(
          'col-start-1 row-start-1 inline-flex items-center gap-1.5',
          isOpening ? `visible ${swapAfterDelay}` : 'invisible',
        )}
      >
        <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
        {t('templates.opening')}
      </span>
    </span>
  )
}

/**
 * The templates browser: a sheet over the canvas, from the left, with the templates as a list and
 * the selected one rendering live beside it. Nothing changes until "Open template" (or Enter).
 * Below 768px it takes the full width and the preview stacks above the list.
 */
export function TemplatesBrowser({
  open,
  onOpenChange,
  selectedId,
  onSelect,
  onOpenTemplate,
  isOpening,
  onCloseAutoFocus,
}: TemplatesBrowserProps) {
  const t = useT()
  const isWide = useMediaQuery(WIDE_SHEET_QUERY)
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const example = findExample(selectedId)

  const list = (
    <div
      key="list"
      className="flex min-h-0 flex-1 flex-col border-t md:w-72 md:flex-none md:border-t-0 md:border-r"
    >
      <div className="min-h-0 overflow-y-auto max-md:flex-1">
        <TemplateList
          examples={listedExamples()}
          selectedId={selectedId}
          onSelect={onSelect}
          onOpen={() => {
            onOpenTemplate(htmlElementOf(document.activeElement))
          }}
        />
      </div>
      {/* Right under the rows, not at the column's foot: with few templates that is far away. */}
      <div className="shrink-0 p-4 text-xs max-md:hidden">
        <KeyHints hints={KEY_HINTS} />
      </div>
    </div>
  )

  const details = example !== undefined && (
    <div key="details" className="flex min-h-0 flex-col max-md:shrink-0 md:flex-1">
      <div className="h-[32dvh] shrink-0 md:h-auto md:min-h-0 md:flex-1">
        <TemplatePreview example={example} title={t(example.title)} />
      </div>
      <TemplateDetailsScroller example={example} />
    </div>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-templates-browser
        showCloseButton={false}
        className="top-14 bottom-4 left-4 h-auto w-[min(960px,92vw)] border bg-background max-md:inset-x-0 max-md:bottom-0 max-md:w-full max-md:border-x-0 max-md:border-b-0"
        onOpenAutoFocus={(event) => {
          // The selected template, wherever the list sits in the DOM (after the preview on a
          // narrow sheet).
          const content = event.currentTarget
          const selected =
            content instanceof HTMLElement
              ? content.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')
              : null
          if (selected === null) return
          event.preventDefault()
          selected.focus()
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <SheetHeader className="shrink-0 gap-1 border-b bg-muted/50 p-4">
          <SheetTitle className="font-heading text-sm font-semibold tracking-wide uppercase">
            {t('templates.title')}
          </SheetTitle>
          <SheetDescription className="text-xs">{t('templates.description')}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* DOM order follows the visual order, so Tab reads the sheet the way it looks. */}
          {isWide ? (
            <>
              {list}
              {details}
            </>
          ) : (
            <>
              {details}
              {list}
            </>
          )}
        </div>
        <SheetFooter className="mt-0 shrink-0 flex-row justify-end gap-2 border-t p-4">
          <SheetClose asChild>
            <Button variant="outline" size="sm">
              {t('common.cancel')}
            </Button>
          </SheetClose>
          <Button
            ref={openButtonRef}
            size="sm"
            // Stays focusable while busy (a disabled button would drop focus to the page).
            aria-busy={isOpening}
            aria-disabled={isOpening}
            className="aria-disabled:cursor-progress"
            onClick={() => {
              onOpenTemplate(openButtonRef.current)
            }}
          >
            <OpenButtonLabel isOpening={isOpening} />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
