import { float } from '@nudo-tsl/core'
import type { Graph, PortValue } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { graphWith, port } from '@/features/node-previews/test-graph'
import { registry } from '@/store/registry'
import type { EditorState } from '@/store/store-types'

import { createStructuralPreviewSync, graphShapedByPreview } from './structural-preview'

const DISTORTION = port('warp', 'distortion')
const SCALE = port('warp', 'scale')

const noiseGraph = (): Graph => graphWith([['warp', 'effects/noise']])

type Channel = Pick<EditorState, 'graph' | 'inputPreview'>

const scrubbing = (graph: Graph, ref: typeof DISTORTION, value: PortValue): Channel => ({
  graph,
  inputPreview: { ref, value },
})

describe('graphShapedByPreview', () => {
  it('rebuilds while a scrubbed Distortion leaves 0', () => {
    const shaped = graphShapedByPreview(noiseGraph(), registry, DISTORTION, float(0.4))
    expect(shaped?.nodes[DISTORTION.nodeId]?.inputValues.distortion).toEqual(float(0.4))
  })

  it('leaves a value that only moves a uniform to the uniform', () => {
    expect(graphShapedByPreview(noiseGraph(), registry, SCALE, float(3))).toBeNull()
  })
})

describe('createStructuralPreviewSync', () => {
  it('builds the scrubbed graph, then the editor graph again when the scrub is cancelled', () => {
    const graph = noiseGraph()
    const built: Graph[] = []
    const sync = createStructuralPreviewSync(registry, (next) => built.push(next))
    const idle: Channel = { graph, inputPreview: null }

    const dragging = scrubbing(graph, DISTORTION, float(0.4))
    sync(dragging, idle)
    sync(idle, dragging)

    expect(built).toHaveLength(2)
    expect(built[0]?.nodes[DISTORTION.nodeId]?.inputValues.distortion).toEqual(float(0.4))
    expect(built[1]).toBe(graph)
  })

  it('builds nothing extra for a scrub that only moves a uniform', () => {
    const graph = noiseGraph()
    const built: Graph[] = []
    const sync = createStructuralPreviewSync(registry, (next) => built.push(next))
    const idle: Channel = { graph, inputPreview: null }

    const dragging = scrubbing(graph, SCALE, float(3))
    sync(dragging, idle)
    sync(idle, dragging)

    expect(built).toHaveLength(0)
  })
})
