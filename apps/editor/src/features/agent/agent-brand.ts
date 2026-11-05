import type { AgentIdentity } from '@nudo-tsl/agent-protocol'

/** The MCP clients nudo recognizes, to show their name and logo instead of their raw client id. */
export type AgentBrand =
  | 'claudeCode'
  | 'cursor'
  | 'codex'
  | 'githubCopilot'
  | 'windsurf'
  | 'geminiCli'
  | 'cline'
  | 'zed'
  | 'goose'
  | 'opencode'
  | 'mistral'
  | 'grok'
  | 'kimi'

interface BrandMatcher {
  readonly brand: AgentBrand
  readonly label: string
  readonly pattern: RegExp
}

/**
 * Matched against the `clientInfo.name` the client sends on `initialize`, which each client words
 * its own way (`claude-code`, `cursor-vscode`, `Visual Studio Code`). A keyword is enough, so a
 * renamed version still matches. Order matters: Cursor and Windsurf are VS Code forks whose names
 * can mention it, so they come before Copilot. Each label matches its own pattern, so naming an
 * agent twice gives the same result.
 */
const BRAND_MATCHERS: readonly BrandMatcher[] = [
  { brand: 'claudeCode', label: 'Claude Code', pattern: /claude/i },
  { brand: 'cursor', label: 'Cursor', pattern: /cursor/i },
  { brand: 'windsurf', label: 'Windsurf', pattern: /windsurf|codeium/i },
  { brand: 'codex', label: 'Codex', pattern: /codex/i },
  { brand: 'geminiCli', label: 'Gemini CLI', pattern: /gemini/i },
  { brand: 'cline', label: 'Cline', pattern: /cline/i },
  { brand: 'zed', label: 'Zed', pattern: /\bzed\b/i },
  { brand: 'goose', label: 'Goose', pattern: /goose/i },
  { brand: 'opencode', label: 'opencode', pattern: /opencode/i },
  { brand: 'mistral', label: 'Mistral', pattern: /mistral|vibe/i },
  { brand: 'grok', label: 'Grok', pattern: /grok|xai/i },
  { brand: 'kimi', label: 'Kimi', pattern: /kimi|moonshot/i },
  {
    brand: 'githubCopilot',
    label: 'GitHub Copilot',
    pattern: /copilot|visual studio code|vscode/i,
  },
]

export interface AgentLook {
  /** The name to show: the client's product name, or the raw client name when unknown. */
  readonly label: string
  /** The logo to show next to it; null for a client nudo does not recognize. */
  readonly brand: AgentBrand | null
}

/** How to show the agent a client name belongs to. */
export function agentLookOf(clientName: string): AgentLook {
  const match = BRAND_MATCHERS.find(({ pattern }) => pattern.test(clientName))
  return match === undefined
    ? { label: clientName, brand: null }
    : { label: match.label, brand: match.brand }
}

/** The identity with its product name, so every place that shows the agent says "Cursor". */
export function withDisplayName(agent: AgentIdentity): AgentIdentity {
  return { ...agent, name: agentLookOf(agent.name).label }
}
