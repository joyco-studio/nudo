import type { AgentPresence } from '@/store/store-types'

export interface ArriveExtras {
  ghost?: AgentPresence['ghost']
  pendingWire?: AgentPresence['pendingWire']
}

/** Moves the agent cursor on the canvas; tools await it so edits land where the cursor is. */
export interface Choreograph {
  arrive(target: AgentPresence['target'], extras?: ArriveExtras): Promise<void>
  settle(): void
}

/** A choreograph with no animation: the cursor is considered there at once. */
export const immediateChoreograph: Choreograph = {
  arrive: () => Promise.resolve(),
  settle: () => undefined,
}
