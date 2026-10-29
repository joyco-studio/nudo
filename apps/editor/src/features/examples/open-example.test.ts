import { MASTER_NODE_ID, createGraph } from '@nudo-tsl/core'
import { beforeEach, describe, expect, it } from 'vitest'

import { EXAMPLES } from '@/examples'
import type { Example } from '@/examples'
import { undo, useEditorStore } from '@/store/editor-store'

import { openExample } from './open-example'

const getState = () => useEditorStore.getState()

function exampleOrFail(id: Example['id']): Example {
  const example = EXAMPLES.find((candidate) => candidate.id === id)
  if (example === undefined) throw new Error(`No example ${id}`)
  return example
}

beforeEach(() => {
  useEditorStore.setState({ graph: createGraph(), notice: null, previewShape: 'sphere' })
  useEditorStore.temporal.getState().clear()
})

describe('openExample', () => {
  it('replaces the graph in one undo step and shows the example on its mesh', () => {
    const before = getState().graph

    expect(openExample(exampleOrFail('pond'), 'en')).toBe(true)

    expect(Object.keys(getState().graph.nodes).length).toBeGreaterThan(60)
    expect(getState().graph.nodes[MASTER_NODE_ID]?.params.lighting).toBe('unlit')
    expect(getState().previewShape).toBe('plane')
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1)
    undo()
    expect(getState().graph).toBe(before)
  })

  it('words the comment frames in the UI language', () => {
    const frameTitles = () =>
      Object.values(getState().graph.nodes)
        .filter((node) => node.type === 'utility/comment')
        .map((node) => node.params.title)

    openExample(exampleOrFail('iridescent-blob'), 'es')
    expect(frameTitles()).toContain('1 · Noise animado')
    openExample(exampleOrFail('iridescent-blob'), 'en')
    expect(frameTitles()).toContain('1 · Animated noise')
  })

  it('keeps the graph and says so when the example does not parse', () => {
    const before = getState().graph
    const broken: Example = { ...exampleOrFail('iridescent-blob'), graph: { schemaVersion: 99 } }

    expect(openExample(broken, 'en')).toBe(false)

    expect(getState().graph).toBe(before)
    expect(getState().notice?.messageKey).toBe('notice.exampleFailed')
  })
})
