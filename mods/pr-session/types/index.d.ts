export type SessionName = string

declare module 'claude-code' {
  interface PluginState {
    'pr-session': { namedSession: SessionName | null; givenName: SessionName | null }
  }
}
