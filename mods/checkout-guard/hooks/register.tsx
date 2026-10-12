import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Neighbor } from '../types'
import { gitCallsThatChangeCheckout } from './commands'

const neighbors = atom({ plugin: 'checkout-guard', key: 'neighbors' } as const, [])
const isDismissed = atom({ plugin: 'checkout-guard', key: 'isDismissed' } as const, false)

const REFRESH_MS = 30_000

type SessionEntry = {
  pid?: number
  sessionId?: string
  cwd?: string
  name?: string
  status?: string
  startedAt?: number
}

async function home($: EngineInterface): Promise<string> {
  return (await $.env.get('HOME')) || ''
}

async function sessionsDir($: EngineInterface): Promise<string> {
  const configDir = (await $.env.get('CLAUDE_CONFIG_DIR')) || `${await home($)}/.claude`
  return `${configDir}/sessions`
}

// The checkout a directory belongs to; a worktree is its own checkout.
async function checkoutOf($: EngineInterface, dirs: string[]): Promise<string | undefined> {
  const argv = ['git', ...dirs.flatMap(dir => ['-C', dir]), 'rev-parse', '--show-toplevel']
  const ran = await $.process.run(argv).catch(() => undefined)
  return ran?.exitCode === 0 ? ran.stdout.trim() : undefined
}

async function isRunning($: EngineInterface, pid: number): Promise<boolean> {
  const ran = await $.process.run(['kill', '-0', String(pid)]).catch(() => undefined)
  return ran?.exitCode === 0
}

// Other live Claude Code sessions whose working directory is in `checkout`.
async function neighborsIn($: EngineInterface, checkout: string): Promise<Neighbor[]> {
  const dir = await sessionsDir($)
  const me = await $.session.id()
  const entries = await $.fs.list(dir).catch(() => [])
  const found: Neighbor[] = []

  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue

    let session: SessionEntry
    try {
      session = JSON.parse(String(await $.fs.read(`${dir}/${entry.name}`)))
    } catch {
      continue
    }
    if (!session.cwd || !session.pid || session.sessionId === me) continue
    if (!(await isRunning($, session.pid))) continue
    if ((await checkoutOf($, [session.cwd])) !== checkout) continue

    found.push({
      name: session.name ?? session.sessionId?.slice(0, 8) ?? String(session.pid),
      status: session.status ?? 'unknown',
      startedAt: session.startedAt ?? 0,
    })
  }

  return found
}

async function refresh($: EngineInterface): Promise<void> {
  const checkout = await checkoutOf($, [])
  const found = checkout === undefined ? [] : await neighborsIn($, checkout)
  await update($, neighbors, () => found)
}

const MOVE_PROMPT =
  'Another Claude session is working in this git checkout. Move this session into a new git ' +
  'worktree with the EnterWorktree tool before changing anything, then tell me the worktree ' +
  'path and branch.'

export const register: Register = on => {
  // Subagents started in a worktree or another directory run git there, not here.
  const elsewhere = new Set<string>()

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    void refresh($)
    $.clock.every(REFRESH_MS, () => void refresh($))

    return started
  })

  on('prompt.submit', async ($, e, next) => {
    void refresh($)

    return next(e)
  })

  // The Agent tool call carries `isolation`; its spawn carries the agent's id.
  const worktreeSpawns = new Set<string>()

  on('tool.call', { tool: 'Agent' }, ($, e, next) => {
    if (e.isolation === 'worktree') worktreeSpawns.add(e.tool_use_id)

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    if (spawned.agentId === undefined) return spawned

    if (worktreeSpawns.delete(e.tool_use_id)) {
      elsewhere.add(spawned.agentId)
    } else if (e.cwd !== undefined) {
      const [mine, theirs] = await Promise.all([checkoutOf($, []), checkoutOf($, [e.cwd])])
      if (theirs !== undefined && theirs !== mine) elsewhere.add(spawned.agentId)
    }

    return spawned
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (e.agentId !== undefined && elsewhere.has(e.agentId)) return next(e)

    const calls = gitCallsThatChangeCheckout(e.command, await home($))
    for (const call of calls) {
      const checkout = await checkoutOf($, call.dirs)
      if (checkout === undefined) continue

      const found = await neighborsIn($, checkout)
      if (found.length === 0) continue

      await update($, neighbors, () => found)
      const names = found.map(n => n.name).join(', ')

      return {
        deny:
          `checkout-guard: another Claude session (${names}) is working in ${checkout}. ` +
          `\`git ${call.subcommand}\` would change the branch or files under it. ` +
          'Move this session into a worktree with EnterWorktree first, or ask the user.',
      }
    }

    return next(e)
  }).catch(($, e, next) =>
    next.called
      ? next(e)
      : { deny: 'checkout-guard: could not check whether another session shares this checkout.' },
  )

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const found = await read($, neighbors)
    if (e.props.hasSurvey || found.length === 0 || (await read($, isDismissed))) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const who = found.map(n => `${n.name} (${n.status})`).join(', ')
    const verb = found.length === 1 ? 'is' : 'are'

    return (
      <Box>
        <Text color="yellow">
          ⚠ {who} {verb} also working in this checkout; branch and file resetting git commands are
          blocked.{' '}
        </Text>
        <Button
          key="worktree"
          label="Use a worktree"
          onPress={async () => {
            await update($, isDismissed, () => true)
            void $.prompt.submit({ text: MOVE_PROMPT })
          }}
        />
        <Button key="dismiss" label="Ignore" onPress={() => update($, isDismissed, () => true)} />
      </Box>
    )
  })
}
