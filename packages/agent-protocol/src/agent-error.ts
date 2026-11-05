export const PROTOCOL_VERSION = 1

export type AgentErrorCode =
  | 'invalid'
  | 'not_found'
  | 'stopped_by_user'
  | 'busy'
  | 'not_connected'
  | 'timeout'
  | 'protocol_mismatch'
  | 'declined'

export interface AgentError {
  code: AgentErrorCode
  message: string
  state?: unknown
}
