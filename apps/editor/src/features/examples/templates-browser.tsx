import { useId, useRef } from 'react'

import { EXAMPLES, findExample } from '@/examples'
import type { ExampleId } from '@/examples'
import { useT } from '@/i18n/use-t'
import { KeyHints } from '@/shared/components/key-hints'
import { htmlElementOf } from '@/shared/lib/html-element-of'
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

import { TemplateDetails } from './template-details'
import { TemplateList } from './template-list'
import { TemplatePreview } from './template-preview'

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
  /** Runs once the sheet has closed, in place of Radix's default, to put focus back. */
  onCloseAutoFocus: (event: Event) => void
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
  onCloseAutoFocus,
}: TemplatesBrowserProps) {
  const t = useT()
  const detailsTitleId = useId()
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const example = findExample(selectedId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-templates-browser
        showCloseButton={false}
        className="top-14 bottom-4 left-4 h-auto w-[min(960px,92vw)] border bg-background max-md:inset-x-0 max-md:bottom-0 max-md:w-full max-md:border-x-0 max-md:border-b-0"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <SheetHeader className="shrink-0 gap-1 border-b bg-muted/50 p-4">
          <SheetTitle className="font-heading text-sm font-semibold tracking-wide uppercase">
            {t('templates.title')}
          </SheetTitle>
          <SheetDescription className="text-xs">{t('templates.description')}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Before the preview in the DOM, so Tab and the sheet's first focus land on the list. */}
          <div className="flex min-h-0 flex-1 flex-col border-t max-md:order-2 md:w-72 md:flex-none md:border-t-0 md:border-r">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <TemplateList
                examples={EXAMPLES}
                selectedId={selectedId}
                onSelect={onSelect}
                onOpen={() => {
                  onOpenTemplate(htmlElementOf(document.activeElement))
                }}
              />
            </div>
            <div className="shrink-0 border-t p-4 text-xs max-md:hidden">
              <KeyHints hints={KEY_HINTS} />
            </div>
          </div>
          {example !== undefined && (
            <div className="flex min-h-0 flex-col max-md:order-1 max-md:shrink-0 md:flex-1">
              <div className="h-[32dvh] shrink-0 md:h-auto md:min-h-0 md:flex-1">
                <TemplatePreview example={example} title={t(example.title)} />
              </div>
              {/* Focusable so a keyboard user can scroll a long property list. */}
              <div
                tabIndex={0}
                role="region"
                aria-labelledby={detailsTitleId}
                data-focus-ring="inset"
                className="shrink-0 border-t md:max-h-[45%] md:overflow-y-auto"
              >
                <TemplateDetails example={example} titleId={detailsTitleId} />
              </div>
            </div>
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
            onClick={() => {
              onOpenTemplate(openButtonRef.current)
            }}
          >
            {t('templates.open')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
