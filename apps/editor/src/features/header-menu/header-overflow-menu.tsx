import { useRef } from 'react'
import type { ReactNode } from 'react'
import { Ellipsis, FilePlus2, LayoutTemplate, Search } from 'lucide-react'

import { useCanvasMenu } from '@/features/canvas/use-canvas-menu'
import { useOpenCommandPalette } from '@/features/command-palette/command-context'
import { useOpenTemplatesBrowser } from '@/features/examples/examples-context'
import { useRequestNewGraph } from '@/features/new-graph/new-graph-context'
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

interface OverflowItemProps {
  icon: ReactNode
  label: string
  onSelect: () => void
}

function OverflowItem({ icon, label, onSelect }: OverflowItemProps) {
  return (
    <DropdownMenuItem className="h-8 gap-2 rounded-none px-2 text-xs" onSelect={onSelect}>
      {icon}
      {label}
    </DropdownMenuItem>
  )
}

/**
 * A narrow (phone) header has no room for Commands, Templates and New graph, so they step out
 * of it and live here instead, one tap away. Each opens its surface once the menu has closed, and
 * that surface gives focus back to this button. Above `sm` the header shows them as buttons.
 */
export function HeaderOverflowMenu() {
  const t = useT()
  const menu = useCanvasMenu()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const openCommandPalette = useOpenCommandPalette()
  const openTemplatesBrowser = useOpenTemplatesBrowser()
  const requestNewGraph = useRequestNewGraph()

  /** Runs after the menu has closed, so its focus return doesn't fight the surface's own. */
  const openAfterClose = (open: (opener: HTMLElement | null) => void): void => {
    menu.runAfterClose(() => {
      open(triggerRef.current)
    })
  }

  return (
    <DropdownMenu onOpenChange={menu.onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="accent"
          size="sm"
          aria-label={t('common.more')}
          className="sm:hidden"
          {...EXCLUSIVE_TRIGGER_PROPS}
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label={t('common.more')}
        align="end"
        className={cn(MENU_SURFACE_CLASS, 'w-auto min-w-44 p-1')}
        onCloseAutoFocus={menu.onCloseAutoFocus}
      >
        <OverflowItem
          icon={<Search aria-hidden="true" />}
          label={t('palette.button')}
          onSelect={() => {
            openAfterClose(openCommandPalette)
          }}
        />
        <OverflowItem
          icon={<LayoutTemplate aria-hidden="true" />}
          label={t('templates.button')}
          onSelect={() => {
            openAfterClose((opener) => {
              openTemplatesBrowser(opener, null)
            })
          }}
        />
        <OverflowItem
          icon={<FilePlus2 aria-hidden="true" />}
          label={t('newGraph.button')}
          onSelect={() => {
            openAfterClose(requestNewGraph)
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
