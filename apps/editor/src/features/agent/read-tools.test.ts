import { MASTER_NODE_TYPE, ok } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import { immediateChoreograph } from './choreography'
import { describeNodeTypes, readTools, type NodeTypeDescription } from './read-tools'
import type { ToolContext } from './tool-context'

const context: ToolContext = {
  agent: { sessionId: 's', name: 'agent' },
  choreograph: immediateChoreograph,
  onTouch: () => undefined,
  lastTouched: () => null,
  canWrite: () => ok(undefined),
  tidyUp: () => Promise.resolve(),
  confirm: () => Promise.resolve(true),
}

const matchesNoise = (entry: NodeTypeDescription): boolean =>
  [entry.type, entry.label, entry.description].some((text) => /noise/i.test(text))

async function listViaHandler(args: unknown): Promise<unknown> {
  const result = await readTools.list_node_types(args, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

describe('read tools', () => {
  it('list_node_types filters by query "noise" and returns ports', async () => {
    const expected = describeNodeTypes({ query: 'NOISE' })

    expect(await listViaHandler({ query: 'NOISE' })).toEqual(expected)
    expect(expected.length).toBeGreaterThan(0)
    expect(expected.every(matchesNoise)).toBe(true)
    expect(expected.some((entry) => entry.inputs.length > 0 && entry.outputs.length > 0)).toBe(true)
  })

  it('list_node_types filters by category', async () => {
    const expected = describeNodeTypes({ category: 'math' })

    expect(await listViaHandler({ category: 'math' })).toEqual(expected)
    expect(expected.length).toBeGreaterThan(0)
    expect(expected.every((entry) => entry.category === 'math')).toBe(true)
  })

  it('list_node_types never lists the master or the reroute', async () => {
    const everything = describeNodeTypes()

    expect(await listViaHandler({})).toEqual(everything)
    expect(everything.length).toBeGreaterThan(0)
    expect(everything.some((entry) => entry.type === MASTER_NODE_TYPE)).toBe(false)
    expect(everything.some((entry) => entry.type === 'utility/reroute')).toBe(false)
  })

  it('list_node_types rejects invalid args with code invalid', async () => {
    const result = await readTools.list_node_types({ query: 5 }, context)

    expect(result).toMatchObject({ ok: false, error: { code: 'invalid' } })
  })

  it('get_code returns the generated module code', async () => {
    const result = await readTools.get_code({}, context)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.value ?? {}).sort()).toEqual(['code', 'errors'])
  })
})
