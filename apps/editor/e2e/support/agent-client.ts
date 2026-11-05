import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/** The name the agent gives the server when it connects; the editor shows it everywhere. */
export const E2E_AGENT_NAME = 'e2e-agent'

const KEY_PATTERN = /Authorization: Bearer (\S+?)"/
const URL_PATTERN = /--transport http nudo (\S+) --header/

/** The Worker URL and the key, read back from the command the connect dialog shows. */
export interface AgentCredentials {
  readonly mcpUrl: string
  readonly key: string
}

export function credentialsFromCommand(command: string): AgentCredentials {
  const mcpUrl = URL_PATTERN.exec(command)?.[1]
  const key = KEY_PATTERN.exec(command)?.[1]
  if (mcpUrl === undefined || key === undefined) {
    throw new Error(`The connect command has no URL or key: ${command}`)
  }
  return { mcpUrl, key }
}

/** An image as `get_preview_image` returns it. */
export interface ToolImage {
  readonly mimeType: string
  readonly data: string
}

export interface AgentClient {
  /** Calls a tool and returns its result, whether or not the tool reported an error. */
  call: (name: string, args?: Record<string, unknown>) => Promise<CallToolResult>
  /** Calls a tool that must succeed and returns its JSON text content, parsed. */
  callJson: (name: string, args?: Record<string, unknown>) => Promise<unknown>
  close: () => Promise<void>
}

/** Every text content of a tool result, joined: what an agent reads, errors included. */
export function textOf(result: CallToolResult): string {
  return result.content
    .flatMap((content) => (content.type === 'text' ? [content.text] : []))
    .join('\n')
}

export function imageOf(result: CallToolResult): ToolImage {
  for (const content of result.content) {
    if (content.type === 'image') return { mimeType: content.mimeType, data: content.data }
  }
  throw new Error(`The tool returned no image: ${textOf(result)}`)
}

/**
 * Connects to the nudo MCP Worker the way Claude Code does after `claude mcp add`: Streamable
 * HTTP to `{url}/mcp` with the key as a bearer token, under the name `e2e-agent`.
 */
export async function connectAgent({ mcpUrl, key }: AgentCredentials): Promise<AgentClient> {
  const client = new Client({ name: E2E_AGENT_NAME, version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: { headers: { Authorization: `Bearer ${key}` } },
  })
  await client.connect(transport)

  const call = async (name: string, args: Record<string, unknown> = {}) =>
    CallToolResultSchema.parse(await client.callTool({ name, arguments: args }))

  return {
    call,
    callJson: async (name, args) => {
      const result = await call(name, args)
      const text = textOf(result)
      if (result.isError === true) throw new Error(`${name} failed: ${text}`)
      const parsed: unknown = JSON.parse(text)
      return parsed
    },
    close: () => client.close(),
  }
}
