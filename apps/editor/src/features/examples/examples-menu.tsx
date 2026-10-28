import { useId, useRef } from 'react'
import { Shapes } from 'lucide-react'

import { EXAMPLES } from '@/examples'
import type { Example } from '@/examples'
import { useCanvasMenu } from '@/features/canvas/use-canvas-menu'
import type { MessageKey } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'
import { MENU_SURFACE_CLASS } from '@/shared/components/menu-surface'
import { EXCLUSIVE_TRIGGER_PROPS } from '@/shared/lib/overlay-coordinator'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

import { useRequestExample } from './examples-context'

/** A short line under the example's name, so the menu says what each one looks like. */
const descriptionKey = (example: Example): MessageKey => `example.${example.id}.description`

interface ExampleItemProps {
  example: Example
  onSelect: () => void
}

function ExampleItem({ example, onSelect }: ExampleItemProps) {
  const t = useT()
  const titleId = useId()
  const descriptionId = useId()
  return (
    <DropdownMenuItem
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="flex-col items-start gap-1 rounded-none p-2"
      onSelect={onSelect}
    >
      <span id={titleId} className="text-xs font-medium">
        {t(example.title)}
      </span>
      <span id={descriptionId} className="text-xs text-muted-foreground">
        {t(descriptionKey(example))}
      </span>
    </DropdownMenuItem>
  )
}

/**
 * The header's Examples menu: one item per bundled example. Picking one opens it in place of the
 * graph (asking first when that would replace work); focus comes back to this button.
 */
export function ExamplesMenu() {
  const t = useT()
  const menu = useCanvasMenu()
  const requestExample = useRequestExample()
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <DropdownMenu onOpenChange={menu.onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            {/* A narrow header has no room for it; like Commands, it steps out (⌘K still lists the
                examples). */}
            <Button
              ref={triggerRef}
              variant="accent"
              size="sm"
              className="max-sm:hidden"
              {...EXCLUSIVE_TRIGGER_PROPS}
            >
              <Shapes aria-hidden="true" />
              <span>{t('examples.button')}</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('examples.tooltip')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        aria-label={t('examples.menu')}
        align="end"
        className={cn(MENU_SURFACE_CLASS, 'w-72 p-1')}
        onCloseAutoFocus={menu.onCloseAutoFocus}
      >
        {EXAMPLES.map((example) => (
          <ExampleItem
            key={example.id}
            example={example}
            onSelect={() => {
              // After the menu has closed, so its focus return doesn't fight the dialog's.
              menu.runAfterClose(() => {
                requestExample(example.id, triggerRef.current)
              })
            }}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
