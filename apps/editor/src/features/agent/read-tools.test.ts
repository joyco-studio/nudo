import { MASTER_NODE_TYPE } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import { immediateChoreograph } from './choreography'
import { describeNodeTypes, readTools } from './read-tools'
import type { ToolContext } from './tool-context'

const context: ToolContext = {
  agent: { sessionId: 's', name: 'agent' },
  choreograph: immediateChoreograph,
  onTouch: () => undefined,
  tidyUp: () => Promise.resolve(),
  confirm: () => Promise.resolve(true),
}

describe('read tools', () => {
  it('list_node_types filters by query "noise" and returns ports', () => {
    const types = describeNodeTypes({ query: 'NOISE' })

    expect(types.length).toBeGreaterThan(0)
    expect(types.every((entry) => /noise/i.test(JSON.stringify(entry)))).toBe(true)
    expect(types.some((entry) => entry.inputs.length > 0 && entry.outputs.length > 0)).toBe(true)
  })

  it('list_node_types never lists the master', async () => {
    const listed = await readTools.list_node_types({}, context)
    expect(listed.ok).toBe(true)
    const types = describeNodeTypes()

    expect(types.some((entry) => entry.type === MASTER_NODE_TYPE)).toBe(false)
    expect(types.some((entry) => entry.type === 'utility/reroute')).toBe(false)
  })

  it('get_code returns the generated module code', async () => {
    const result = await readTools.get_code({}, context)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.value ?? {}).sort()).toEqual(['code', 'errors'])
  })
})
