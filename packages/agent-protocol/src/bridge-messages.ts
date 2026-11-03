import { err, ok, type Result } from '@nudo-tsl/core'
import { z } from 'zod'
import type { AgentError } from './agent-error'
import { TOOL_NAMES } from './tool-catalog'

export const MAX_MESSAGE_BYTES = 1_048_576

const agentErrorSchema = z.object({
  code: z.enum([
    'invalid',
    'not_found',
    'stopped_by_user',
    'busy',
    'not_connected',
    'timeout',
    'protocol_mismatch',
    'declined',
  ]),
  message: z.string(),
  state: z.unknown().optional(),
})

const agentIdentitySchema = z.object({ sessionId: z.string(), name: z.string() })

const helloSchema = z.object({
  kind: z.literal('hello'),
  protocolVersion: z.number(),
  key: z.string(),
  tabId: z.string(),
  /** Whether the tab had focus when it connected; a background tab never takes over the agent. */
  focused: z.boolean(),
})

const focusSchema = z.object({ kind: z.literal('focus'), tabId: z.string() })

const responseSchema = z.discriminatedUnion('ok', [
  z.object({
    kind: z.literal('response'),
    id: z.string(),
    ok: z.literal(true),
    result: z.unknown(),
  }),
  z.object({
    kind: z.literal('response'),
    id: z.string(),
    ok: z.literal(false),
    error: agentErrorSchema,
  }),
])

const browserMessageSchema = z.union([helloSchema, focusSchema, responseSchema])

const welcomeSchema = z.object({ kind: z.literal('welcome'), activeTabId: z.string() })

const rejectedSchema = z.object({
  kind: z.literal('rejected'),
  reason: z.enum(['bad_key', 'protocol_mismatch']),
})

const requestSchema = z.object({
  kind: z.literal('request'),
  id: z.string(),
  tool: z.enum(TOOL_NAMES),
  args: z.unknown(),
  agent: agentIdentitySchema,
})

const activeTabSchema = z.object({ kind: z.literal('active-tab'), activeTabId: z.string() })

/** Sent by the room when a browser frame is malformed; the socket stays open. */
const roomErrorSchema = z.object({ kind: z.literal('error'), error: agentErrorSchema })

const roomMessageSchema = z.discriminatedUnion('kind', [
  welcomeSchema,
  rejectedSchema,
  requestSchema,
  activeTabSchema,
  roomErrorSchema,
])

export type AgentIdentity = z.infer<typeof agentIdentitySchema>
export type BrowserMessage = z.infer<typeof browserMessageSchema>
export type RoomMessage = z.infer<typeof roomMessageSchema>
export type BridgeRequest = z.infer<typeof requestSchema>
export type BridgeResponse = z.infer<typeof responseSchema>

const invalid = (message: string): Result<never, AgentError> => err({ code: 'invalid', message })

const parseMessage = <T>(raw: string, schema: z.ZodType<T>): Result<T, AgentError> => {
  if (raw.length > MAX_MESSAGE_BYTES) return invalid('Message exceeds the maximum size.')
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return invalid('Message is not valid JSON.')
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) return invalid(z.prettifyError(parsed.error))
  return ok(parsed.data)
}

export const parseBrowserMessage = (raw: string): Result<BrowserMessage, AgentError> =>
  parseMessage(raw, browserMessageSchema)

export const parseRoomMessage = (raw: string): Result<RoomMessage, AgentError> =>
  parseMessage(raw, roomMessageSchema)
