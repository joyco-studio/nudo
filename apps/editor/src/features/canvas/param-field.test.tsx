import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { asNodeId } from '@nudo-tsl/core'
import type { GraphNode, ParamDefinition, ParamValue } from '@nudo-tsl/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/shared/ui/tooltip'

import { NodeFieldActionsContext } from './node-field-actions'
import type { NodeFieldActions } from './node-field-actions'
import { ParamField, bodyParams } from './param-field'
import type { BodyParam } from './param-field'

const OCTAVES: ParamDefinition = {
  id: 'octaves',
  label: 'Octaves',
  kind: 'number',
  default: 1,
  min: 1,
  max: 8,
  step: 1,
}

const nodeWith = (params: Readonly<Record<string, ParamValue>>): GraphNode => ({
  id: asNodeId('noise'),
  type: 'effects/noise',
  position: { x: 0, y: 0 },
  inputValues: {},
  params,
})

const asBodyParam = (param: ParamDefinition): BodyParam => {
  const [bodyParam] = bodyParams([param])
  if (bodyParam === undefined) throw new Error(`${param.id} is not a body param`)
  return bodyParam
}

describe('bodyParams', () => {
  it('keeps a visible number param next to enums and switches', () => {
    const hidden: ParamDefinition = {
      id: 'width',
      label: 'Width',
      kind: 'number',
      default: 320,
      hidden: true,
    }
    const text: ParamDefinition = { id: 'title', label: 'Title', kind: 'string', default: '' }
    const toggle: ParamDefinition = { id: 'wrap', label: 'Wrap', kind: 'boolean', default: true }
    expect(bodyParams([OCTAVES, hidden, text, toggle]).map((param) => param.id)).toEqual([
      'octaves',
      'wrap',
    ])
  })
})

describe('ParamField for a number param', () => {
  let container: HTMLDivElement
  let root: Root
  let setParam: ReturnType<typeof vi.fn<NodeFieldActions['setParam']>>

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    setParam = vi.fn<NodeFieldActions['setParam']>()
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  function render(params: Readonly<Record<string, ParamValue>>): HTMLInputElement {
    const actions: NodeFieldActions = {
      setInputValue: vi.fn(),
      previewInputValue: vi.fn(),
      endInputPreview: vi.fn(),
      setParam,
    }
    act(() => {
      root.render(
        <TooltipProvider>
          <NodeFieldActionsContext value={actions}>
            <ul>
              <ParamField node={nodeWith(params)} param={asBodyParam(OCTAVES)} />
            </ul>
          </NodeFieldActionsContext>
        </TooltipProvider>,
      )
    })
    const input = container.querySelector('input')
    if (input === null) throw new Error('The number field did not render an input')
    return input
  }

  function press(input: HTMLInputElement, key: string): void {
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    })
  }

  function type(input: HTMLInputElement, text: string): void {
    // React tracks the value itself, so the native setter is what makes `input` read as a change.
    const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
    act(() => {
      valueDescriptor?.set?.call(input, text)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('renders a labelled field showing the stored value, or the default', () => {
    expect(render({ octaves: 3 }).value).toBe('3')
    expect(container.querySelector('label')?.textContent).toBe('Octaves')
    expect(render({}).value).toBe('1')
  })

  it('steps up on ArrowUp, from 1 to 2', () => {
    press(render({ octaves: 1 }), 'ArrowUp')
    expect(setParam).toHaveBeenCalledExactlyOnceWith({ nodeId: 'noise', paramId: 'octaves' }, 2)
  })

  it('steps down on ArrowDown', () => {
    press(render({ octaves: 4 }), 'ArrowDown')
    expect(setParam).toHaveBeenCalledExactlyOnceWith({ nodeId: 'noise', paramId: 'octaves' }, 3)
  })

  it('does not step past its bounds', () => {
    press(render({ octaves: 8 }), 'ArrowUp')
    press(render({ octaves: 1 }), 'ArrowDown')
    expect(setParam).not.toHaveBeenCalled()
  })

  it('commits a typed value on Enter, rounded and clamped', () => {
    const input = render({ octaves: 1 })
    type(input, '4.4')
    press(input, 'Enter')
    type(input, '99')
    press(input, 'Enter')
    expect(setParam.mock.calls.map(([, value]) => value)).toEqual([4, 8])
  })

  it('commits a typed value on blur', () => {
    const input = render({ octaves: 1 })
    type(input, '5')
    act(() => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(setParam).toHaveBeenCalledExactlyOnceWith({ nodeId: 'noise', paramId: 'octaves' }, 5)
  })
})
