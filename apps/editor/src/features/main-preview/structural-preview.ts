import { setInputValue, topologyKey } from '@nudo-tsl/core'
import type { Graph, NodeRegistry, PortRef, PortValue } from '@nudo-tsl/core'

import type { EditorState } from '@/store/store-types'

/**
 * The graph with a scrubbed value written in, when that value changes how the graph compiles: an
 * `offAtZero` input (a Noise's Distortion) leaving or reaching 0. A uniform cannot show that, since
 * the build left the input's work out, so the previews must build from this graph instead. `null`
 * when the value only moves a uniform.
 */
export function graphShapedByPreview(
  graph: Graph,
  registry: NodeRegistry,
  ref: PortRef,
  value: PortValue,
): Graph | null {
  const previewed = setInputValue(graph, ref, value)
  if (!previewed.ok) return null
  const isSameShape = topologyKey(previewed.value, registry) === topologyKey(graph, registry)
  return isSameShape ? null : previewed.value
}

type GraphChannel = Pick<EditorState, 'graph' | 'inputPreview'>

/**
 * Feeds `update` the graph a preview should build: the editor graph, or, while a scrubbed value
 * changes its shape, the graph with that value in. The returned listener remembers whether the
 * last build came from a preview, so a scrub that ends without a commit (a cancel) builds the
 * editor graph again.
 */
export function createStructuralPreviewSync(
  registry: NodeRegistry,
  update: (graph: Graph) => void,
): (state: GraphChannel, previous: GraphChannel) => void {
  let isShowingPreview = false
  return (state, previous) => {
    const { graph, inputPreview } = state
    if (inputPreview !== null && inputPreview !== previous.inputPreview) {
      const shaped = graphShapedByPreview(graph, registry, inputPreview.ref, inputPreview.value)
      if (shaped !== null) {
        isShowingPreview = true
        update(shaped)
        return
      }
    }
    if (graph !== previous.graph || (isShowingPreview && inputPreview === null)) {
      isShowingPreview = false
      update(graph)
    }
  }
}
