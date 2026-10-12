export type Info = {
  repo: string | null
  kubeContext: string | null
  model: string | null
  effort: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'session-info': { info: Info }
  }
}
