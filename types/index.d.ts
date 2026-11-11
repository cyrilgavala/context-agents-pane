export type ContextUsage = { used: number; window: number; percent: number; isCompactWindow: boolean }
export type AgentRow = { id: string; type: string; status: string; label: string }
export type AgentSample = { rows: AgentRow[]; at: number; error?: string }
export type ContextRow = { name: string; tokens: number; kind: 'used' | 'free' | 'buffer' | 'deferred' }

declare module 'claude-code' {
  interface PluginState {
    'context-agents-pane': {
      context: Shaped<ContextUsage>
      agents: Shaped<AgentSample>
      breakdown: Shaped<ContextRow[]>
    }
  }
}
