import { Empty, EmptyDescription } from '@/shared/ui/empty'

/** The code drawer's body. The live module comes with the code generator. */
export function CodePanel() {
  return (
    <Empty className="items-start p-3 text-left">
      <EmptyDescription className="text-xs">Generated TSL appears here.</EmptyDescription>
    </Empty>
  )
}
