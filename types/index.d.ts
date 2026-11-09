export type AgentRow = {
  id: string
  description: string
  type: string
  status: string
  startedAt: number
  endedAt?: number
  tool?: string
  toolCount: number
  recent: string[]
  hue: number
}

declare module 'claude-code' {
  interface PluginState {
    'agent-watch': { agents: Shaped<AgentRow[]>; now: number }
  }
}
