import { TOOL_CATALOG } from '@nudo-tsl/agent-protocol'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { exports } from 'cloudflare:workers'
import { afterEach, describe, expect, it } from 'vitest'
import { callTool, type Room } from './mcp-endpoint'
import { connectTab, roomFor } from './testing/bridge-socket'

const MCP_URL = 'https://nudo-mcp.test/mcp'
const CLIENT_NAME = 'test-client'
const PNG_BASE64 = 'iVBORw0KGgo='

const uniqueKey = (): string => `key-${crypto.randomUUID()}`

const workerFetch = (url: string | URL, init?: RequestInit): Promise<Response> =>
  exports.default.fetch(new Request(url, init))

const openClients: Client[] = []

const connectClient = async (key: string): Promise<Client> => {
  const client = new Client({ name: CLIENT_NAME, version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    fetch: workerFetch,
    requestInit: { headers: { Authorization: `Bearer ${key}` } },
  })
  await client.connect(transport)
  openClients.push(client)
  return client
}

const initializeBody = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: CLIENT_NAME, version: '1.0.0' },
  },
})

const getGraphCallBody = JSON.stringify({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: { name: 'get_graph', arguments: {} },
})

const postMcp = (body: string, headers: Record<string, string>): Promise<Response> =>
  workerFetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body,
  })

const postInitialize = (headers: Record<string, string>): Promise<Response> =>
  postMcp(initializeBody, headers)

afterEach(async () => {
  await Promise.all(openClients.splice(0).map((client) => client.close()))
})

describe('MCP endpoint', () => {
  it('rejects a request without a bearer key with 401', async () => {
    const response = await postInitialize({})
    expect(response.status).toBe(401)
    const body: unknown = await response.json()
    expect(body).toMatchObject({ jsonrpc: '2.0', id: null })
    expect(JSON.stringify(body)).toContain('Connect an agent')
  })

  it('rejects an empty bearer key with 401', async () => {
    const response = await postInitialize({ Authorization: 'Bearer ' })
    expect(response.status).toBe(401)
  })

  it('issues a session id on initialize', async () => {
    const response = await postInitialize({ Authorization: `Bearer ${uniqueKey()}` })
    expect(response.status).toBe(200)
    expect(response.headers.get('Mcp-Session-Id')).toMatch(/.+/)
  })

  it('rejects a non-initialize request without a session id with 400', async () => {
    const response = await postMcp(getGraphCallBody, { Authorization: `Bearer ${uniqueKey()}` })
    expect(response.status).toBe(400)
  })

  it("falls back to 'Agent' for a session the room does not know", async () => {
    const key = uniqueKey()
    const tab = await connectTab(key, 'tab-1')

    const response = postMcp(getGraphCallBody, {
      Authorization: `Bearer ${key}`,
      'Mcp-Session-Id': 'unknown-session',
    })
    const request = await tab.next('request')
    expect(request.agent).toEqual({ sessionId: 'unknown-session', name: 'Agent' })
    tab.send({ kind: 'response', id: request.id, ok: true, result: {} })

    expect((await response).status).toBe(200)
    tab.close()
  })

  it('DELETE ends the session: the room forgets its client name', async () => {
    const key = uniqueKey()
    const initialized = await postInitialize({ Authorization: `Bearer ${key}` })
    const sessionId = initialized.headers.get('Mcp-Session-Id') ?? ''
    const room = await roomFor(key)
    await expect(room.touchSession(sessionId)).resolves.toBe(CLIENT_NAME)

    const response = await workerFetch(MCP_URL, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}`, 'Mcp-Session-Id': sessionId },
    })

    expect(response.status).toBe(200)
    await expect(room.touchSession(sessionId)).resolves.toBeNull()
  })

  it('lists every catalog tool', async () => {
    const client = await connectClient(uniqueKey())
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      TOOL_CATALOG.map((spec) => spec.name).sort(),
    )
  })

  it('a call with no tab connected returns isError with not_connected', async () => {
    const client = await connectClient(uniqueKey())
    const result = await client.callTool({ name: 'get_graph', arguments: {} })
    expect(result.isError).toBe(true)
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'not_connected: nudo is not open. Ask the person to open nudo in their browser; it reconnects by itself.',
      },
    ])
  })

  it('a call reaches a connected tab with the client name', async () => {
    const key = uniqueKey()
    const tab = await connectTab(key, 'tab-1')
    const client = await connectClient(key)

    const call = client.callTool({ name: 'add_node', arguments: { type: 'add' } })
    const request = await tab.next('request')
    expect(request).toMatchObject({ tool: 'add_node', args: { type: 'add' } })
    expect(request.agent.name).toBe(CLIENT_NAME)
    tab.send({ kind: 'response', id: request.id, ok: true, result: { nodeId: 'n1' } })

    const result = await call
    expect(result.isError).toBeFalsy()
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify({ nodeId: 'n1' }) }])
    tab.close()
  })

  it('returns an agent error as isError with its code, message and state', async () => {
    const key = uniqueKey()
    const tab = await connectTab(key, 'tab-1')
    const client = await connectClient(key)

    const call = client.callTool({ name: 'remove_nodes', arguments: { ids: ['missing'] } })
    const request = await tab.next('request')
    tab.send({
      kind: 'response',
      id: request.id,
      ok: false,
      error: { code: 'not_found', message: 'No node missing.', state: { nodes: [] } },
    })

    const result = await call
    expect(result.isError).toBe(true)
    expect(result.content).toEqual([
      { type: 'text', text: 'not_found: No node missing.' },
      { type: 'text', text: JSON.stringify({ nodes: [] }) },
    ])
    tab.close()
  })

  it('get_preview_image results come back as image content', async () => {
    const key = uniqueKey()
    const tab = await connectTab(key, 'tab-1')
    const client = await connectClient(key)

    const call = client.callTool({ name: 'get_preview_image', arguments: {} })
    const request = await tab.next('request')
    tab.send({
      kind: 'response',
      id: request.id,
      ok: true,
      result: { mimeType: 'image/png', data: PNG_BASE64 },
    })

    const result = await call
    expect(result.isError).toBeFalsy()
    expect(result.content).toEqual([{ type: 'image', mimeType: 'image/png', data: PNG_BASE64 }])
    tab.close()
  })

  it.each(['image/webp', 'image/jpeg'])(
    'get_preview_image accepts a %s the tab re-encoded to fit',
    async (mimeType) => {
      const key = uniqueKey()
      const tab = await connectTab(key, 'tab-1')
      const client = await connectClient(key)

      const call = client.callTool({ name: 'get_preview_image', arguments: {} })
      const request = await tab.next('request')
      tab.send({ kind: 'response', id: request.id, ok: true, result: { mimeType, data: 'AAAA' } })

      const result = await call
      expect(result.isError).toBeFalsy()
      expect(result.content).toEqual([{ type: 'image', mimeType, data: 'AAAA' }])
      tab.close()
    },
  )

  it('get_preview_image refuses an image type it does not know', async () => {
    const key = uniqueKey()
    const tab = await connectTab(key, 'tab-1')
    const client = await connectClient(key)

    const call = client.callTool({ name: 'get_preview_image', arguments: {} })
    const request = await tab.next('request')
    tab.send({
      kind: 'response',
      id: request.id,
      ok: true,
      result: { mimeType: 'image/gif', data: 'AAAA' },
    })

    const result = await call
    expect(result.isError).toBe(true)
    tab.close()
  })
})

describe('callTool', () => {
  const getGraph = TOOL_CATALOG.find((spec) => spec.name === 'get_graph')
  const brokenRoom = (failure: Error): Room => ({
    dispatch: () => Promise.reject(failure),
    registerSession: () => Promise.resolve(),
    touchSession: () => Promise.resolve('test-client'),
    forgetSession: () => Promise.resolve(),
  })

  it('maps a thrown room RPC (a reset Durable Object) to not_connected instead of failing', async () => {
    if (getGraph === undefined) throw new Error('get_graph is missing from the catalog')
    const room = brokenRoom(new Error('Durable Object reset because its code was updated.'))

    const result = await callTool(room, 'session-1', getGraph, {})

    expect(result.isError).toBe(true)
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'not_connected: Durable Object reset because its code was updated.',
      },
    ])
  })

  it('maps a thrown client name lookup to not_connected too', async () => {
    if (getGraph === undefined) throw new Error('get_graph is missing from the catalog')
    const room: Room = {
      ...brokenRoom(new Error('unused')),
      touchSession: () => Promise.reject(new Error('Network connection lost.')),
    }

    const result = await callTool(room, 'session-1', getGraph, {})

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'not_connected: Network connection lost.' }],
    })
  })
})
