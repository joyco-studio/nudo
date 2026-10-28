import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { asNodeId } from '@nudo-tsl/core'
import type { NodeId } from '@nudo-tsl/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CodePanel } from './code-panel'
import type { FailedNode } from './failed-nodes'

const MODULE = ["import { color } from 'three/tsl'", '', 'export const nodes = {}'].join('\n')
const SINE: FailedNode = { nodeId: asNodeId('sine'), title: 'Sine' }
const NOISE: FailedNode = { nodeId: asNodeId('noise'), title: 'Noise' }

describe('CodePanel', () => {
  let container: HTMLDivElement
  let root: Root
  const onShowNode = vi.fn<(nodeId: NodeId) => void>()

  function render(code: string, failedNodes: readonly FailedNode[]): HTMLElement {
    act(() => {
      root.render(<CodePanel code={code} failedNodes={failedNodes} onShowNode={onShowNode} />)
    })
    const region = container.querySelector<HTMLElement>('[role="region"]')
    if (region === null) throw new Error('No code region rendered')
    return region
  }

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    onShowNode.mockReset()
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('is a named, focusable region holding exactly the module, one numbered line per line', () => {
    const region = render(MODULE, [])

    expect(region.getAttribute('aria-label')).toBe('Generated TSL')
    expect(region.tabIndex).toBe(0)
    expect(region.querySelector('pre')?.textContent).toBe(MODULE)
    expect(region.querySelectorAll('[data-code-line]')).toHaveLength(3)
    expect(region.querySelector('[data-token="keyword"]')?.textContent).toBe('import')
  })

  it('lists the failing nodes instead of code, each a button that shows its node', () => {
    const region = render('', [SINE, NOISE])

    expect(region.querySelector('pre')).toBeNull()
    expect(region.querySelector('h3')?.textContent).toBe("Can't generate the code yet")
    const buttons = [...region.querySelectorAll('button')]
    expect(buttons.map((button) => button.textContent)).toEqual(['Sine', 'Noise'])

    act(() => {
      buttons[1]?.click()
    })

    expect(onShowNode).toHaveBeenCalledWith(NOISE.nodeId)
  })
})
