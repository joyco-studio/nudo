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

export interface ChoreographOptions {
  reducedMotion: () => boolean
  travelMs: number
  setPresence: (presence: AgentPresence | null) => void
  wait: (ms: number) => Promise<void>
}

const NO_TRAVEL_MS = 0

/** Publishes the agent presence, waits for the cursor to travel, and clears transient visuals on settle. */
export function createChoreograph(options: ChoreographOptions): Choreograph {
  let current: AgentPresence | null = null

  return {
    async arrive(target, extras) {
      current = { target, ghost: extras?.ghost ?? null, pendingWire: extras?.pendingWire ?? null }
      options.setPresence(current)
      await options.wait(options.reducedMotion() ? NO_TRAVEL_MS : options.travelMs)
    },
    settle() {
      if (current === null) return
      current = { target: current.target, ghost: null, pendingWire: null }
      options.setPresence(current)
    },
  }
}
