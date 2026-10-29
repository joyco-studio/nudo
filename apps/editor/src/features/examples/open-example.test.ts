import { MASTER_NODE_ID, asNodeId, createGraph, texture } from '@nudo-tsl/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EXAMPLES } from '@/examples'
import { textureFixtureExample } from '@/examples/fixtures'
import type { Example } from '@/examples'
import { PAPER_GRAIN } from '@/examples/build/bundled-textures'
import { templateTexture } from '@/examples/template-texture'
import { undo, useEditorStore } from '@/store/editor-store'

import { loadTemplateTextures } from './load-template-textures'
import type { TemplateTextureLoad } from './load-template-textures'
import { openExample } from './open-example'

vi.mock('./load-template-textures', () => ({ loadTemplateTextures: vi.fn() }))

const GRAIN_ASSET = 'c'.repeat(64)
const GRAIN_NODE_ID = asNodeId('grain')

const getState = () => useEditorStore.getState()

function exampleOrFail(id: Example['id']): Example {
  const example = EXAMPLES.find((candidate) => candidate.id === id)
  if (example === undefined) throw new Error(`No example ${id}`)
  return example
}

const TEXTURE_FIXTURE_EXAMPLE = textureFixtureExample()

const grainSlot = () => getState().graph.nodes[GRAIN_NODE_ID]?.inputValues.texture

const NOTHING_LOADED: TemplateTextureLoad = { bindings: new Map(), failed: [], unsaved: [] }
const GRAIN_LOADED: TemplateTextureLoad = {
  bindings: new Map([['paper-grain', GRAIN_ASSET]]),
  failed: [],
  unsaved: [],
}

/** Holds the textures back until the test lets them in. */
function deferTextures(): (load: TemplateTextureLoad) => void {
  let resolveLoad: (load: TemplateTextureLoad) => void = () => undefined
  vi.mocked(loadTemplateTextures).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveLoad = resolve
    }),
  )
  return (load) => {
    resolveLoad(load)
  }
}

beforeEach(() => {
  useEditorStore.setState({ graph: createGraph(), notice: null, previewShape: 'sphere' })
  useEditorStore.temporal.getState().clear()
  vi.mocked(loadTemplateTextures).mockReset()
  vi.mocked(loadTemplateTextures).mockResolvedValue(NOTHING_LOADED)
})

describe('openExample', () => {
  it('replaces the graph in one undo step and shows the example on its mesh', async () => {
    const before = getState().graph

    expect(await openExample(exampleOrFail('pond'), 'en')).toBe(true)

    expect(Object.keys(getState().graph.nodes).length).toBeGreaterThan(60)
    expect(getState().graph.nodes[MASTER_NODE_ID]?.params.lighting).toBe('unlit')
    expect(getState().previewShape).toBe('plane')
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1)
    undo()
    expect(getState().graph).toBe(before)
  })

  it('words the comment frames in the UI language', async () => {
    const frameTitles = () =>
      Object.values(getState().graph.nodes)
        .filter((node) => node.type === 'utility/comment')
        .map((node) => node.params.title)

    await openExample(exampleOrFail('iridescent-blob'), 'es')
    expect(frameTitles()).toContain('1 · Noise animado')
    await openExample(exampleOrFail('iridescent-blob'), 'en')
    expect(frameTitles()).toContain('1 · Animated noise')
  })

  it('keeps the graph and says so when the example does not parse', async () => {
    const before = getState().graph
    const broken: Example = { ...exampleOrFail('iridescent-blob'), graph: { schemaVersion: 99 } }

    expect(await openExample(broken, 'en')).toBe(false)

    expect(getState().graph).toBe(before)
    expect(getState().notice?.messageKey).toBe('notice.exampleFailed')
    expect(loadTemplateTextures).not.toHaveBeenCalled()
  })

  it('stores the template textures and points its slots at them, in the same undo step', async () => {
    vi.mocked(loadTemplateTextures).mockResolvedValue(GRAIN_LOADED)
    const before = getState().graph

    expect(await openExample(TEXTURE_FIXTURE_EXAMPLE, 'en')).toBe(true)

    expect(loadTemplateTextures).toHaveBeenCalledWith(TEXTURE_FIXTURE_EXAMPLE.textures, 'open')
    expect(grainSlot()).toEqual(texture(GRAIN_ASSET))
    expect(getState().notice).toBeNull()
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1)
    undo()
    expect(getState().graph).toBe(before)
  })

  it('opens with a texture that did not load as missing, and says so', async () => {
    vi.mocked(loadTemplateTextures).mockResolvedValue({
      ...NOTHING_LOADED,
      failed: TEXTURE_FIXTURE_EXAMPLE.textures,
    })

    expect(await openExample(TEXTURE_FIXTURE_EXAMPLE, 'en')).toBe(true)

    expect(grainSlot()).toEqual(templateTexture(PAPER_GRAIN))
    expect(getState().notice?.messageKey).toBe('notice.templateTexturesFailed')
  })

  it('leaves the graph alone when a newer request came while the textures loaded', async () => {
    const before = getState().graph

    expect(await openExample(TEXTURE_FIXTURE_EXAMPLE, 'en', () => false)).toBe(false)

    expect(getState().graph).toBe(before)
    expect(getState().previewShape).toBe('sphere')
  })

  it('opens with a texture it could not store bound for the session, and says it is unsaved', async () => {
    vi.mocked(loadTemplateTextures).mockResolvedValue({
      ...GRAIN_LOADED,
      unsaved: TEXTURE_FIXTURE_EXAMPLE.textures,
    })

    expect(await openExample(TEXTURE_FIXTURE_EXAMPLE, 'en')).toBe(true)

    expect(grainSlot()).toEqual(texture(GRAIN_ASSET))
    expect(getState().notice?.messageKey).toBe('notice.templateTexturesUnsaved')
  })

  it('drops the template when an undo swapped the graph while its textures loaded', async () => {
    getState().replaceGraph(createGraph())
    const edited = getState().graph
    const letTexturesIn = deferTextures()

    const opening = openExample(TEXTURE_FIXTURE_EXAMPLE, 'en')
    undo()
    const undone = getState().graph
    letTexturesIn(GRAIN_LOADED)

    expect(await opening).toBe(false)
    expect(undone).not.toBe(edited)
    expect(getState().graph).toBe(undone)
    expect(getState().previewShape).toBe('sphere')
    expect(useEditorStore.temporal.getState().futureStates).toHaveLength(1)
  })

  it('drops the template when the graph was replaced or reset while its textures loaded', async () => {
    const letPondIn = deferTextures()
    const openingPond = openExample(exampleOrFail('pond'), 'en')
    getState().resetGraph()
    const reset = getState().graph
    letPondIn(NOTHING_LOADED)

    expect(await openingPond).toBe(false)
    expect(getState().graph).toBe(reset)

    const letFixtureIn = deferTextures()
    const openingFixture = openExample(TEXTURE_FIXTURE_EXAMPLE, 'en')
    expect(await openExample(exampleOrFail('pond'), 'en')).toBe(true)
    const pond = getState().graph
    letFixtureIn(GRAIN_LOADED)

    expect(await openingFixture).toBe(false)
    expect(getState().graph).toBe(pond)
  })
})
