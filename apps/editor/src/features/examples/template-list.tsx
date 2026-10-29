import { useId, useRef } from 'react'
import type { KeyboardEvent } from 'react'

import type { Example, ExampleId } from '@/examples'
import { plural } from '@/i18n/translate'
import { useT } from '@/i18n/use-t'
import { cn } from '@/shared/lib/utils'

import { templateFacts } from './template-facts'
import {
  EMPTY_TYPEAHEAD,
  isTypeaheadKey,
  moveSelection,
  nextTypeahead,
  typeaheadIndex,
} from './template-listbox'
import type { TypeaheadState } from './template-listbox'
import { templateDescriptionKey, templateTagKey } from './template-text'

/** APG's typeahead window: keys closer together than this add up to one query. */
const TYPEAHEAD_RESET_MS = 500

interface TemplateOptionProps {
  example: Example
  isSelected: boolean
  onSelect: () => void
  ref: (element: HTMLLIElement | null) => void
}

/** One template: its name, what it looks like, its tags and how many nodes it has. */
function TemplateOption({ example, isSelected, onSelect, ref }: TemplateOptionProps) {
  const t = useT()
  const titleId = useId()
  const detailsId = useId()
  const nodeCount = templateFacts(example)?.nodeCount ?? 0

  return (
    <li
      ref={ref}
      role="option"
      aria-selected={isSelected}
      aria-labelledby={titleId}
      aria-describedby={detailsId}
      // Roving focus: the selected option is the list's one stop in the tab order.
      tabIndex={isSelected ? 0 : -1}
      data-template-option={example.id}
      // Selection and focus look apart: the accent fill and the primary bar mark the selected row
      // whether or not it has focus; the quiet inset line (keyboard only) says the list has focus,
      // as when Shift+Tab comes back to it.
      data-focus-ring="inset"
      className={cn(
        'relative flex cursor-pointer flex-col gap-2 border-b p-4 select-none hover:bg-muted/60',
        isSelected &&
          'bg-accent before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary hover:bg-accent',
      )}
      onClick={onSelect}
    >
      <span id={titleId} className="text-sm font-medium">
        {t(example.title)}
      </span>
      <span id={detailsId} className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">{t(templateDescriptionKey(example))}</span>
        <span className="flex items-baseline justify-between gap-4 text-xs">
          {/* Plain words on the text's own edge: a boxed chip would start its letters inside. */}
          <span className="truncate font-mono text-micro text-muted-foreground">
            {example.tags.map((tag) => t(templateTagKey(tag))).join(' · ')}
          </span>
          <span className="shrink-0 font-mono text-muted-foreground tabular-nums">
            {t(plural(nodeCount, { one: 'templates.nodes.one', other: 'templates.nodes.other' }), {
              count: nodeCount,
            })}
          </span>
        </span>
      </span>
    </li>
  )
}

export interface TemplateListProps {
  examples: readonly Example[]
  selectedId: ExampleId
  onSelect: (id: ExampleId) => void
  /** Enter on an option: open the selected template. */
  onOpen: () => void
}

/**
 * The templates as a single-select listbox where selection follows focus (APG): Up and Down step,
 * Home and End jump, typing a title's first letters finds it, and Enter opens the selection.
 * Clicking a row selects it.
 */
export function TemplateList({ examples, selectedId, onSelect, onOpen }: TemplateListProps) {
  const t = useT()
  const titles = examples.map((example) => t(example.title))
  const optionsRef = useRef(new Map<ExampleId, HTMLLIElement>())
  const typeaheadRef = useRef<TypeaheadState>(EMPTY_TYPEAHEAD)
  const selectedIndex = Math.max(
    0,
    examples.findIndex((example) => example.id === selectedId),
  )

  const selectAt = (index: number): void => {
    const example = examples[index]
    if (example === undefined) return
    onSelect(example.id)
    optionsRef.current.get(example.id)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'Enter') {
      event.preventDefault()
      onOpen()
      return
    }
    const moved = moveSelection(event.key, selectedIndex, examples.length)
    if (moved !== null) {
      event.preventDefault()
      selectAt(moved)
      return
    }
    if (!isTypeaheadKey(event.key, typeaheadRef.current)) return
    event.preventDefault()
    const typeahead = nextTypeahead(
      typeaheadRef.current,
      event.key,
      event.timeStamp,
      TYPEAHEAD_RESET_MS,
    )
    typeaheadRef.current = typeahead
    const found = typeaheadIndex(titles, typeahead.query, selectedIndex)
    if (found !== null) selectAt(found)
  }

  return (
    <ul
      role="listbox"
      aria-label={t('templates.list')}
      aria-orientation="vertical"
      className="flex flex-col"
      onKeyDown={onKeyDown}
    >
      {examples.map((example) => (
        <TemplateOption
          key={example.id}
          example={example}
          isSelected={example.id === selectedId}
          onSelect={() => {
            onSelect(example.id)
          }}
          ref={(element) => {
            if (element === null) optionsRef.current.delete(example.id)
            else optionsRef.current.set(example.id, element)
          }}
        />
      ))}
    </ul>
  )
}
