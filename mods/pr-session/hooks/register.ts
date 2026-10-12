import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { age, sessionNameForPr, today } from './names'

const namedSession = atom({ plugin: 'pr-session', key: 'namedSession' } as const, null)
const givenName = atom({ plugin: 'pr-session', key: 'givenName' } as const, null)

type SessionEntry = { sessionId?: string; name?: string; nameSource?: string }

async function configDir($: EngineInterface): Promise<string> {
  return (await $.env.get('CLAUDE_CONFIG_DIR')) || `${(await $.env.get('HOME')) || ''}/.claude`
}

async function git($: EngineInterface, args: string[]): Promise<string | undefined> {
  const ran = await $.process.run(['git', ...args]).catch(() => undefined)
  return ran?.exitCode === 0 ? ran.stdout.trim() : undefined
}

// This session's row in the session registry, which holds its name.
async function ownEntry($: EngineInterface): Promise<SessionEntry | undefined> {
  const dir = `${await configDir($)}/sessions`
  const me = await $.session.id()
  const entries = await $.fs.list(dir).catch(() => [])

  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    try {
      const session: SessionEntry = JSON.parse(String(await $.fs.read(`${dir}/${entry.name}`)))
      if (session.sessionId === me) return session
    } catch {
      continue
    }
  }

  return undefined
}

// A session is renamed once, and only while it carries the name Claude Code
// derived for it or the one this mod gave it before a /clear.
async function mayRename($: EngineInterface): Promise<boolean> {
  if ((await read($, namedSession)) === (await $.session.id())) return false

  const entry = await ownEntry($)
  if (entry === undefined) return (await read($, givenName)) === null

  return entry.nameSource === 'derived' || entry.name === (await read($, givenName))
}

// The repository's name, the same from any of its worktrees.
async function repoName($: EngineInterface): Promise<string> {
  const common = await git($, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  const dir = common?.replace(/\/\.git\/?$/, '') ?? (await $.session.cwd())
  return dir.split('/').filter(Boolean).pop() ?? 'unknown'
}

async function handoffDir($: EngineInterface): Promise<string> {
  return `${await configDir($)}/handoffs/${await repoName($)}`
}

async function sessionName($: EngineInterface): Promise<string> {
  const entry = await ownEntry($)
  return entry?.name ?? (await read($, givenName)) ?? (await $.session.id()).slice(0, 8)
}

// A command's own hook cannot submit a prompt (the session would wait on
// itself), so the prompt goes once the command has finished.
function submitAfter($: EngineInterface, text: string): void {
  $.clock.after(0, () => void $.prompt.submit({ text }).catch(() => {}))
}

async function handoffPrompt($: EngineInterface, path: string, name: string, note: string) {
  const branch = (await git($, ['branch', '--show-current'])) || '(detached)'
  const base = (await git($, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])) ?? 'master'
  const commits = (await git($, ['log', '--oneline', '-30', `${base}..HEAD`])) || '(none)'
  const status = (await git($, ['status', '--short']))?.split('\n').slice(0, 50).join('\n') || '(clean)'
  const date = today(await $.clock.now())

  return [
    `Write a handoff for this session to ${path} so a fresh session can continue the work`,
    'without this conversation. Use exactly this shape:',
    '',
    `# Handoff: ${name} (${date})`,
    '## Goal',
    '## Done',
    '## In flight',
    '## Next steps',
    '## Gotchas',
    '## Resume with',
    `/resume-handoff ${name}`,
    '',
    'Ground "Done" in these facts, read just now, plus the PRs opened and review comments posted',
    'in this conversation:',
    `- worktree: ${await $.session.cwd()}`,
    `- branch: ${branch} (base ${base})`,
    '- commits ahead of base:',
    commits,
    '- uncommitted changes:',
    status,
    '',
    'Be specific: file paths, PR numbers, commands, and the decisions the user made with their',
    'reasons. Leave out anything a new session cannot use.',
    note ? `The user's note for this handoff: ${note}` : '',
    'Reply with only the path once it is written.',
  ].join('\n')
}

export const register: Register = on => {
  let pendingName: string | undefined

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({
      name: 'handoff',
      description: 'Write a handoff file so a new session can pick up this work',
      argumentHint: '[note]',
    })
    await $.command.register({
      name: 'resume-handoff',
      description: "List this repo's handoffs, or load one into this session",
      argumentHint: '[name or number]',
    })

    return started
  })

  on('prompt.submit', async ($, e, next) => {
    const name = sessionNameForPr(e.text)
    if (name !== undefined && pendingName === undefined && (await mayRename($))) {
      pendingName = name
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined || pendingName === undefined) return done

    const name = pendingName
    pendingName = undefined
    const me = await $.session.id()
    await update($, namedSession, () => me)
    await update($, givenName, () => name)
    // /rename runs once the session is idle, after this turn has ended.
    $.clock.after(0, () => void $.command.run({ command: 'rename', args: name }).catch(() => {}))

    return done
  })

  on('command.run', { command: 'handoff' }, async ($, e) => {
    const name = await sessionName($)
    const path = `${await handoffDir($)}/${name}.md`
    submitAfter($, await handoffPrompt($, path, name, e.args.trim()))

    return { text: `Writing a handoff to ${path}` }
  })

  on('command.run', { command: 'resume-handoff' }, async ($, e) => {
    const dir = await handoffDir($)
    const now = await $.clock.now()
    const files = (await $.fs.list(dir).catch(() => []))
      .filter(f => f.kind === 'file' && f.name.endsWith('.md'))
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
    if (files.length === 0) return { text: `No handoffs in ${dir} yet.` }

    const wanted = e.args.trim()
    if (wanted === '') {
      const rows = files.map((f, i) => `${i + 1}. ${f.name.replace(/\.md$/, '')} (${age(now - f.mtimeMs)})`)
      return { text: [...rows, '', 'Run /resume-handoff <name or number> to load one.'].join('\n') }
    }

    const byNumber = /^\d+$/.test(wanted) ? files[Number(wanted) - 1] : undefined
    const file = byNumber ?? files.find(f => f.name === `${wanted}.md` || f.name === wanted)
    if (file === undefined) return { text: `No handoff named ${wanted} in ${dir}.` }

    const path = `${dir}/${file.name}`
    submitAfter(
      $,
      `Read ${path} and pick up where it leaves off. Before changing anything, tell me ` +
        'where things stand and what the next step is.',
    )

    return { text: `Loading ${path}` }
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    const dir = `${await configDir($)}/handoffs/`
    if (ran.deny === undefined && !ran.isError && e.file_path.startsWith(dir)) {
      const name = e.file_path.split('/').pop()?.replace(/\.md$/, '')
      $.ui.toast(`Handoff saved: ${e.file_path}. In a new session: /resume-handoff ${name}`)
    }

    return ran
  })
}
