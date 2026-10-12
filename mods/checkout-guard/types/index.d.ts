export type Neighbor = { name: string; status: string; startedAt: number }

declare module 'claude-code' {
  interface PluginState {
    'checkout-guard': { neighbors: Neighbor[]; isDismissed: boolean }
  }
}
