import { describe, expect, it } from 'vitest'
import {
  CONFIRM_TOOL_TIMEOUT_MS,
  DEFAULT_TOOL_TIMEOUT_MS,
  TOOL_CATALOG,
  TOOL_NAMES,
  type ToolName,
} from './tool-catalog'

const spec = (name: ToolName) => {
  const found = TOOL_CATALOG.find((tool) => tool.name === name)
  if (!found) throw new Error(`missing spec ${name}`)
  return found
}

describe('TOOL_CATALOG', () => {
  it('has exactly one spec for every ToolName', () => {
    expect(TOOL_CATALOG.map((tool) => tool.name).sort()).toEqual([...TOOL_NAMES].sort())
  })

  it('add_node rejects a NaN position', () => {
    const result = spec('add_node').args.safeParse({ type: 'math/add', position: { x: NaN, y: 0 } })
    expect(result.success).toBe(false)
  })

  it('add_node accepts a missing position', () => {
    expect(spec('add_node').args.safeParse({ type: 'math/add' }).success).toBe(true)
  })

  it('new_graph and load_template use the confirm timeout', () => {
    expect(spec('new_graph').timeoutMs).toBe(CONFIRM_TOOL_TIMEOUT_MS)
    expect(spec('load_template').timeoutMs).toBe(CONFIRM_TOOL_TIMEOUT_MS)
    expect(spec('get_graph').timeoutMs).toBe(DEFAULT_TOOL_TIMEOUT_MS)
  })
})
