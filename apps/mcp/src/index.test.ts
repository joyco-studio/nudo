import { hashKey } from '@nudo-tsl/agent-protocol'
import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { bridgeRequest } from './testing/bridge-socket'

describe('worker router', () => {
  it('rejects a bridge upgrade from a foreign origin with 403', async () => {
    const response = await exports.default.fetch(
      bridgeRequest(await hashKey('k'), 'https://evil.example'),
    )
    expect(response.status).toBe(403)
  })

  it('lets the editor read the 403, so it can say its origin is not allowed', async () => {
    const response = await exports.default.fetch(
      new Request(`https://nudo-mcp.test/bridge/${await hashKey('k')}`, {
        headers: { Origin: 'https://evil.example' },
      }),
    )
    expect(response.status).toBe(403)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('rejects a bridge request without an Origin header with 403', async () => {
    const response = await exports.default.fetch(
      new Request(`https://nudo-mcp.test/bridge/${await hashKey('k')}`, {
        headers: { Upgrade: 'websocket' },
      }),
    )
    expect(response.status).toBe(403)
  })

  it('requires a WebSocket upgrade on the bridge route', async () => {
    const response = await exports.default.fetch(
      new Request(`https://nudo-mcp.test/bridge/${await hashKey('k')}`, {
        headers: { Origin: 'http://localhost:5173' },
      }),
    )
    expect(response.status).toBe(426)
  })

  it('returns 404 for a bridge path that is not a sha256 hex hash', async () => {
    const response = await exports.default.fetch(bridgeRequest('not-a-hash'))
    expect(response.status).toBe(404)
  })

  it('returns 404 for unknown routes', async () => {
    const response = await exports.default.fetch('https://nudo-mcp.test/nope')
    expect(response.status).toBe(404)
  })

  it('upgrades a bridge request from an allowed origin', async () => {
    const response = await exports.default.fetch(bridgeRequest(await hashKey('k')))
    expect(response.status).toBe(101)
    response.webSocket?.accept()
    response.webSocket?.close()
  })
})
