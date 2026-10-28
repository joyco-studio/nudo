import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, Ref } from 'react'
import type { BlackboardProperty } from '@nudo-tsl/core'
import { ChevronDown, ChevronRight, GripVertical, SquarePlus, Trash2 } from 'lucide-react'

import { TypeChip } from '@/shared/components/type-chip'
import { Button } from '@/shared/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { useT } from '@/i18n/use-t'

import type { BlackboardActions } from './blackboard-actions'
import { PROPERTY_HANDLE_ATTRIBUTE, focusSiblingHandle } from './property-focus'
import { PROPERTY_KIND_SPECS, propertyKindOf } from './property-kinds'
import { renameLabelOrExplain } from './property-messages'
import { startPropertyDrag } from './property-drag'
import { PropertyDetails } from './property-details'
import { PropertyTextField } from './property-text-field'
import { PropertyValueField } from './property-value-field'
import { startRenaming, stopRenaming, useIsRenaming } from './renaming-property'

const DELETE_KEYS: ReadonlySet<string> = new Set(['Delete', 'Backspace'])
const ARROW_OFFSETS: Readonly<Record<string, 1 | -1>> = { ArrowDown: 1, ArrowUp: -1 }

export interface PropertyRowProps {
  property: BlackboardProperty
  actions: BlackboardActions
  /** Deletes the property and moves focus to a neighbor. */
  onDelete: () => void
}

interface PropertyHandleProps {
  property: BlackboardProperty
  actions: BlackboardActions
  onDelete: () => void
  ref: Ref<HTMLButtonElement>
}

/**
 * The property's name, as the row's handle. It is the drag source onto the canvas. From the
 * keyboard, Enter (or Space) adds the property to the canvas, F2 renames it, Delete removes it and
 * the arrow keys move between rows. A pointer click only focuses it, so a stray click never adds a
 * node (the row's "Add to canvas" button does that); a double click renames it.
 */
function PropertyHandle({ property, actions, onDelete, ref }: PropertyHandleProps) {
  const descriptionId = useId()
  const t = useT()

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const offset = ARROW_OFFSETS[event.key]
    if (offset !== undefined) {
      event.preventDefault()
      focusSiblingHandle(event.currentTarget, offset)
      return
    }
    if (event.key === 'F2') {
      event.preventDefault()
      startRenaming(property.id)
      return
    }
    if (DELETE_KEYS.has(event.key)) {
      event.preventDefault()
      onDelete()
    }
  }

  const onClick = (event: MouseEvent<HTMLButtonElement>): void => {
    // Keyboard activation has no click count; pointer clicks carry one and add nothing.
    if (event.detail === 0) actions.addToCanvas(property.id)
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            type="button"
            draggable
            {...{ [PROPERTY_HANDLE_ATTRIBUTE]: property.id }}
            aria-describedby={descriptionId}
            aria-keyshortcuts="Enter F2 Delete"
            className="flex h-6 min-w-0 flex-1 cursor-pointer items-center gap-1 px-1 text-left text-xs font-medium hover:bg-accent hover:text-accent-foreground"
            onClick={onClick}
            onDoubleClick={() => {
              startRenaming(property.id)
            }}
            onKeyDown={onKeyDown}
            onDragStart={(event) => {
              startPropertyDrag(event.dataTransfer, property.id)
            }}
          >
            <GripVertical aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{property.label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" aria-hidden="true">
          <span className="flex flex-col">
            <span>{t('property.dragHint')}</span>
            <span className="text-micro opacity-80">{t('property.renameHint')}</span>
          </span>
        </TooltipContent>
      </Tooltip>
      <span id={descriptionId} className="sr-only">
        {t('property.handleDescription')}
      </span>
    </>
  )
}

/**
 * One Blackboard property: its name (the handle), type chip, "Add to canvas" and delete buttons,
 * its value editor, and a disclosure with the name, reference and exposed settings.
 */
export function PropertyRow({ property, actions, onDelete }: PropertyRowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const isRenaming = useIsRenaming(property.id)
  const handleRef = useRef<HTMLButtonElement>(null)
  const isHandleFocusOwed = useRef(false)
  const t = useT()

  // The handle mounts again when a rename ends: focus it before anything else can move focus.
  useLayoutEffect(() => {
    if (isRenaming || !isHandleFocusOwed.current) return
    isHandleFocusOwed.current = false
    handleRef.current?.focus()
  }, [isRenaming])
  const chip = PROPERTY_KIND_SPECS[propertyKindOf(property)].chip

  return (
    <li className="border-b last:border-b-0">
      <Collapsible asChild open={isOpen} onOpenChange={setIsOpen}>
        <div role="group" aria-label={property.label} className="flex flex-col">
          <div className="flex h-8 items-center gap-1 px-1">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t('property.details')}
                className="text-muted-foreground hover:text-foreground"
              >
                {isOpen ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </Button>
            </CollapsibleTrigger>
            {isRenaming ? (
              <PropertyTextField
                accessibleName={t('property.renameField')}
                font="sans"
                isAutoFocused
                className="flex-1"
                value={property.label}
                onInvalidBlur="revert"
                commit={(text) =>
                  renameLabelOrExplain((label) => actions.renameLabel(property.id, label), text, t)
                }
                onDone={(_outcome, via) => {
                  // Leaving by key keeps the keyboard on the row; a click elsewhere keeps its
                  // target.
                  isHandleFocusOwed.current = via === 'key'
                  stopRenaming()
                }}
              />
            ) : (
              <PropertyHandle
                ref={handleRef}
                property={property}
                actions={actions}
                onDelete={onDelete}
              />
            )}
            <TypeChip>{chip}</TypeChip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('property.addNamedToCanvas', { name: property.label })}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    actions.addToCanvas(property.id)
                  }}
                >
                  <SquarePlus aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('property.addToCanvas')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('property.delete')}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('property.delete')}</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex min-h-7 flex-wrap items-center gap-x-1.5 pr-2 pb-1 pl-8">
            <PropertyValueField
              property={property}
              onCommit={(value) => {
                actions.setValue(property.id, value)
              }}
              onPreview={(value) => {
                actions.previewValue(property.id, value)
              }}
              onPreviewEnd={actions.endPreview}
            />
          </div>
          <CollapsibleContent>
            <PropertyDetails property={property} actions={actions} />
          </CollapsibleContent>
        </div>
      </Collapsible>
    </li>
  )
}
