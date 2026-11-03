import { describe, expect, it, vi } from 'vitest'
import { MAX_MESSAGE_BYTES, parseBrowserMessage, parseRoomMessage } from './bridge-messages'

describe('parseBrowserMessage', () => {
  it('parses a valid hello', () => {
    const raw = JSON.stringify({ kind: 'hello', protocolVersion: 1, key: 'k', tabId: 't' })
    expect(parseBrowserMessage(raw).ok).toBe(true)
  })

  it('rejects invalid JSON with code invalid', () => {
    const result = parseBrowserMessage('{')
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid' } })
  })

  it('rejects an unknown kind', () => {
    const result = parseBrowserMessage(JSON.stringify({ kind: 'nope' }))
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid' } })
  })

  it('rejects a message over MAX_MESSAGE_BYTES without parsing it', () => {
    const parseSpy = vi.spyOn(JSON, 'parse')
    const result = parseBrowserMessage('a'.repeat(MAX_MESSAGE_BYTES + 1))
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid' } })
    expect(parseSpy).not.toHaveBeenCalled()
    parseSpy.mockRestore()
  })
})

describe('parseRoomMessage', () => {
  it('parses a request', () => {
    const raw = JSON.stringify({
      kind: 'request',
      id: '1',
      tool: 'get_graph',
      args: {},
      agent: { sessionId: 's', name: 'n' },
    })
    expect(parseRoomMessage(raw).ok).toBe(true)
  })

  it('rejects an unknown tool', () => {
    const raw = JSON.stringify({
      kind: 'request',
      id: '1',
      tool: 'nope',
      args: {},
      agent: { sessionId: 's', name: 'n' },
    })
    expect(parseRoomMessage(raw).ok).toBe(false)
  })

  it('parses an error carrying an invalid AgentError', () => {
    const raw = JSON.stringify({ kind: 'error', error: { code: 'invalid', message: 'bad' } })
    expect(parseRoomMessage(raw)).toEqual({
      ok: true,
      value: { kind: 'error', error: { code: 'invalid', message: 'bad' } },
    })
  })
})
