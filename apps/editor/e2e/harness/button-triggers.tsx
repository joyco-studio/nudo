import '@fontsource-variable/public-sans'
import '../../src/app/globals.css'
import '../../src/app/focus-ring.css'

import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DropdownMenu, Select } from 'radix-ui'

import { trackInputModality } from '@/shared/lib/input-modality'
import { Button } from '@/shared/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

/**
 * Every Radix trigger that wraps the shared `Button` with `asChild`, on a page of its own: the
 * defect under test is how a keyboard press reaches the trigger, not anything about the editor.
 */
function ButtonTriggers() {
  const [clicks, setClicks] = useState(0)
  return (
    <main className="flex flex-col items-start gap-3 p-6">
      <Button
        onClick={() => {
          setClicks((count) => count + 1)
        }}
      >
        Plain
      </Button>
      <output aria-label="Plain clicks">{clicks}</output>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="outline">Dropdown</Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="bg-popover p-1">
            <DropdownMenu.Item>Item one</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Select.Root>
        <Select.Trigger asChild>
          <Button variant="outline">Select</Button>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="bg-popover p-1">
            <Select.Viewport>
              <Select.Item value="one">
                <Select.ItemText>Option one</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Popover</Button>
        </PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline">Collapsible</Button>
        </CollapsibleTrigger>
        <CollapsibleContent>Collapsible body</CollapsibleContent>
      </Collapsible>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog title</DialogTitle>
          <DialogDescription>Dialog body</DialogDescription>
        </DialogContent>
      </Dialog>
    </main>
  )
}

trackInputModality(document)

const rootElement = document.getElementById('root')
if (rootElement === null) throw new Error('Missing #root element in the harness page.')
createRoot(rootElement).render(
  <StrictMode>
    <ButtonTriggers />
  </StrictMode>,
)
