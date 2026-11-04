import { useId, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { RichMessage } from '@/i18n/rich-message'
import { useT } from '@/i18n/use-t'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import type { KeyAdoption } from './agent-bridge'
import { existingKeyMessage, SHOW_KEY_COMMAND } from './agent-ui-model'

export interface AgentExistingKeyFormProps {
  /** Switches to the pasted key; what happened, so the form can say it. */
  onAdoptKey: (input: string) => KeyAdoption
  /** Runs after a key was adopted, to move focus off the form that then closes. */
  onAdopted: () => void
}

const isRefusal = (adoption: KeyAdoption | null): boolean =>
  adoption === 'invalid' || adoption === 'unconfigured'

/**
 * "I already have a key": a disclosure with a field for the key the person uses in another
 * browser, so this one joins the same agent without reconfiguring Claude Code.
 */
export function AgentExistingKeyForm({ onAdoptKey, onAdopted }: AgentExistingKeyFormProps) {
  const t = useT()
  const regionId = useId()
  const inputId = useId()
  const hintId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  const [adoption, setAdoption] = useState<KeyAdoption | null>(null)

  const isInvalid = isRefusal(adoption)
  const describedBy = isInvalid ? `${hintId} ${errorId}` : hintId
  const confirmation =
    adoption === 'adopted' || adoption === 'unchanged' ? t(existingKeyMessage(adoption)) : ''

  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const result = onAdoptKey(value)
    setAdoption(result)
    if (result !== 'adopted') {
      inputRef.current?.focus()
      return
    }
    onAdopted()
    setValue('')
    setIsOpen(false)
  }

  const ToggleIcon = isOpen ? ChevronDown : ChevronRight
  return (
    <div className="grid">
      <div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={isOpen}
          {...(isOpen ? { 'aria-controls': regionId } : {})}
          onClick={() => {
            setIsOpen((open) => !open)
            setAdoption(null)
          }}
        >
          <ToggleIcon aria-hidden="true" />
          {t('agent.connect.existingKey')}
        </Button>
      </div>
      {isOpen ? (
        <form id={regionId} className="mt-2 grid gap-2" noValidate onSubmit={submit}>
          <Label htmlFor={inputId} className="text-xs">
            {t('agent.connect.existingKeyLabel')}
          </Label>
          <p id={hintId} className="text-xs text-muted-foreground">
            <RichMessage
              messageKey="agent.connect.existingKeyHint"
              values={{ command: <code className="font-mono">{SHOW_KEY_COMMAND}</code> }}
            />
          </p>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              id={inputId}
              value={value}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              aria-invalid={isInvalid}
              aria-describedby={describedBy}
              onChange={(event) => {
                setValue(event.target.value)
                if (isInvalid) setAdoption(null)
              }}
            />
            <Button type="submit" variant="outline" size="sm" className="h-8 shrink-0">
              {t('agent.connect.useKey')}
            </Button>
          </div>
          {isInvalid && adoption !== null ? (
            <p id={errorId} className="text-xs text-destructive">
              {t(existingKeyMessage(adoption))}
            </p>
          ) : null}
        </form>
      ) : null}
      <p role="status" className="mt-2 text-xs text-muted-foreground empty:mt-0">
        {confirmation}
      </p>
    </div>
  )
}
