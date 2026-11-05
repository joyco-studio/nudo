import { describe, expect, it } from 'vitest'

import { agentLookOf, withDisplayName } from './agent-brand'
import { AGENT_BRAND_ICONS } from './agent-brand-icons'

describe('agentLookOf', () => {
  it.each([
    ['claude-code', 'Claude Code', 'claudeCode'],
    ['cursor-vscode', 'Cursor', 'cursor'],
    ['codex-mcp-client', 'Codex', 'codex'],
    ['Visual Studio Code', 'GitHub Copilot', 'githubCopilot'],
    ['Visual Studio Code - Insiders', 'GitHub Copilot', 'githubCopilot'],
    ['windsurf-client', 'Windsurf', 'windsurf'],
    ['gemini-cli-mcp-client', 'Gemini CLI', 'geminiCli'],
    ['Cline', 'Cline', 'cline'],
    ['Zed', 'Zed', 'zed'],
    ['goose', 'Goose', 'goose'],
    ['opencode', 'opencode', 'opencode'],
    ['mistral-vibe', 'Mistral', 'mistral'],
    ['grok-cli', 'Grok', 'grok'],
    ['kimi-cli', 'Kimi', 'kimi'],
  ] as const)('recognizes %s as %s', (clientName, label, brand) => {
    expect(agentLookOf(clientName)).toEqual({ label, brand })
  })

  it('keeps the raw name of a client it does not recognize, with no logo', () => {
    expect(agentLookOf('my-agent')).toEqual({ label: 'my-agent', brand: null })
    // A word that merely contains "zed" is not Zed.
    expect(agentLookOf('organized-bot')).toEqual({ label: 'organized-bot', brand: null })
  })

  it('names an agent the same way twice, since the editor stores the product name', () => {
    for (const clientName of ['claude-code', 'cursor-vscode', 'Visual Studio Code', 'kimi-cli']) {
      const { label, brand } = agentLookOf(clientName)
      expect(agentLookOf(label)).toEqual({ label, brand })
    }
  })

  it('has a logo for every brand it recognizes', () => {
    for (const icon of Object.values(AGENT_BRAND_ICONS)) {
      expect(icon.paths.length).toBeGreaterThan(0)
    }
  })
})

describe('withDisplayName', () => {
  it('replaces the client name and keeps the session', () => {
    expect(withDisplayName({ sessionId: 's1', name: 'cursor-vscode' })).toEqual({
      sessionId: 's1',
      name: 'Cursor',
    })
  })
})
