import { describe, expect, it, vi } from 'vitest'
import type { AgentPresence } from '@/store/store-types'
import { createChoreograph } from './choreography'

const POINT: AgentPresence['target'] = { kind: 'point', position: { x: 10, y: 20 } }
const GHOST: NonNullable<AgentPresence['ghost']> = {
  type: 'math.add',
  position: { x: 10, y: 20 },
}
const TRAVEL_MS = 400

function setup(reducedMotion = false) {
  const events: string[] = []
  const presences: Array<AgentPresence | null> = []
  const wait = vi.fn((ms: number) => {
    events.push(`wait:${String(ms)}`)
    return Promise.resolve()
  })
  const choreograph = createChoreograph({
    reducedMotion: () => reducedMotion,
    travelMs: TRAVEL_MS,
    setPresence: (presence) => {
      events.push('presence')
      presences.push(presence)
    },
    wait,
  })
  return { choreograph, events, presences, wait }
}

describe('createChoreograph', () => {
  it('the store action runs only after arrive resolves', async () => {
    const { choreograph, events } = setup()
    const arrival = choreograph.arrive(POINT).then(() => events.push('store-action'))
    expect(events).toEqual(['presence', `wait:${String(TRAVEL_MS)}`])
    await arrival
    expect(events).toEqual(['presence', `wait:${String(TRAVEL_MS)}`, 'store-action'])
  })

  it('reduced motion applies with zero wait', async () => {
    const { choreograph, wait, presences } = setup(true)
    await choreograph.arrive(POINT)
    expect(wait).toHaveBeenCalledWith(0)
    expect(presences).toHaveLength(1)
  })

  it('add_node shows a ghost during arrival and clears it after settle', async () => {
    const { choreograph, presences } = setup()
    await choreograph.arrive(POINT, { ghost: GHOST })
    expect(presences.at(-1)).toEqual({ target: POINT, ghost: GHOST, pendingWire: null })
    choreograph.settle()
    expect(presences.at(-1)).toEqual({ target: POINT, ghost: null, pendingWire: null })
  })

  it('settle before any arrival does nothing', () => {
    const { choreograph, presences } = setup()
    choreograph.settle()
    expect(presences).toEqual([])
  })
})
