import { MASTER_NODE_ID, asNodeId, serializeGraph } from '@nudo-tsl/core'
import type { Graph, GraphNode } from '@nudo-tsl/core'
import { createMaterial } from '@nudo-tsl/runtime'
import { describe, expect, it } from 'vitest'

import { registry } from '@/store/registry'

import { templateTexturesIn } from '../bind-template-textures'
import { buildExampleGraph } from './build-example-graph'
import { frameIdOf } from './example-spec'
import type { ExampleSpec } from './example-spec'
import { IRIDESCENT_BLOB } from './iridescent-blob'
import { LAVA_FLOW } from './lava-flow'
import { estimateGeometry } from './node-geometry'
import {
  BUBBLEGUM_SPEC,
  CHARCOAL_CHROME_SPEC,
  DUSK_GLAZE_SPEC,
  FROST_SPECKLE_SPEC,
  INK_SWIRL_SPEC,
  MIDNIGHT_GLAZE_SPEC,
  NIGHT_LEAF_SPEC,
  PASTEL_PLANET_SPEC,
  PEWTER_HAZE_SPEC,
  ROSE_MOON_SPEC,
} from './painterly-spheres'
import { POND } from './pond'
import { POSTER } from './poster'
import { TEXTURE_FIXTURE } from './texture-fixture'

/**
 * Builds every example from its spec and keeps the committed `.graph.json` in step: run
 * `pnpm --filter @nudo-tsl/editor exec vitest run src/examples --update` (from the repo root) after
 * changing a spec to write the files again.
 */
const SPECS: readonly (readonly [id: string, spec: ExampleSpec])[] = [
  ['pond', POND],
  ['iridescent-blob', IRIDESCENT_BLOB],
  ['poster', POSTER],
  ['lava-flow', LAVA_FLOW],
  ['midnight-glaze', MIDNIGHT_GLAZE_SPEC],
  ['pastel-planet', PASTEL_PLANET_SPEC],
  ['bubblegum', BUBBLEGUM_SPEC],
  ['frost-speckle', FROST_SPECKLE_SPEC],
  ['dusk-glaze', DUSK_GLAZE_SPEC],
  ['charcoal-chrome', CHARCOAL_CHROME_SPEC],
  ['pewter-haze', PEWTER_HAZE_SPEC],
  ['rose-moon', ROSE_MOON_SPEC],
  ['ink-swirl', INK_SWIRL_SPEC],
  ['night-leaf', NIGHT_LEAF_SPEC],
  ['texture-fixture', TEXTURE_FIXTURE],
]

interface Box {
  readonly id: string
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

function boxOf(node: GraphNode): Box {
  const definition = registry.get(node.type)
  if (definition === undefined) throw new Error(`Unknown type ${node.type}`)
  const { width, height } = estimateGeometry(node, definition, node.position)
  const { x, y } = node.position
  return { id: node.id, left: x, top: y, right: x + width, bottom: y + height }
}

const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

function frameBox(graph: Graph, frameId: string): Box {
  const frame = graph.nodes[asNodeId(frameId)]
  if (frame === undefined) throw new Error(`No frame ${frameId}`)
  const { x, y } = frame.position
  return {
    id: frameId,
    left: x,
    top: y,
    right: x + Number(frame.params.width),
    bottom: y + Number(frame.params.height),
  }
}

describe.each(SPECS)('the %s example', (id, spec) => {
  const graph = buildExampleGraph(spec, registry)

  it('matches its committed graph file', async () => {
    await expect(`${serializeGraph(graph)}\n`).toMatchFileSnapshot(`../${id}.graph.json`)
  })

  it('builds a material without node errors', () => {
    expect(createMaterial(graph, registry).errors).toEqual([])
  })

  it('names only the textures it bundles, and uses every one', () => {
    const bundled = (spec.textures ?? []).map((texture) => texture.id)

    expect([...templateTexturesIn(graph)].sort()).toEqual([...bundled].sort())
    expect(new Set(bundled).size).toBe(bundled.length)
  })

  it('keeps every node clear of the others, previews included', () => {
    const boxes = Object.values(graph.nodes)
      .filter((node) => !node.id.startsWith('frame-'))
      .map(boxOf)
    const collisions = boxes.flatMap((box, index) =>
      boxes.slice(index + 1).flatMap((other) => (overlaps(box, other) ? [[box.id, other.id]] : [])),
    )
    expect(collisions).toEqual([])
  })

  it('frames each group around its nodes, without frames overlapping', () => {
    const frames = spec.groups.map((group) => frameBox(graph, frameIdOf(group.id)))
    for (const group of spec.groups) {
      const frame = frameBox(graph, frameIdOf(group.id))
      for (const member of group.nodes) {
        const node = graph.nodes[asNodeId(member.id)]
        if (node === undefined) throw new Error(`No node ${member.id}`)
        const box = boxOf(node)
        expect(box.left, member.id).toBeGreaterThanOrEqual(frame.left)
        expect(box.right, member.id).toBeLessThanOrEqual(frame.right)
        expect(box.top, member.id).toBeGreaterThanOrEqual(frame.top)
        expect(box.bottom, member.id).toBeLessThanOrEqual(frame.bottom)
      }
    }
    const master = graph.nodes[MASTER_NODE_ID]
    const all = master === undefined ? frames : [...frames, boxOf(master)]
    const collisions = all.flatMap((box, index) =>
      all.slice(index + 1).flatMap((other) => (overlaps(box, other) ? [[box.id, other.id]] : [])),
    )
    expect(collisions).toEqual([])
  })
})
