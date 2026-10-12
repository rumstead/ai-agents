import { describe, expect, mock, test } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'

import { gitCallsThatChangeCheckout } from '../hooks/commands'

type Session = { pid: number; sessionId: string; cwd: string; name: string; status: string }

// A machine where `/repo` and `/repo-wt` are separate checkouts and the given
// sessions are registered, each alive unless its pid is in `dead`.
function machine(on: On, sessions: Session[], dead: number[] = []) {
  on('session.id', () => ({ value: 'me' }))
  mock.env(on, { HOME: '/home/u' })
  on('fs.list', () => ({
    value: sessions.map(s => ({ name: `${s.pid}.json`, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })),
  }))
  on('fs.read', ($, e) => {
    const pid = Number(e.path.split('/').pop()?.replace('.json', ''))
    return { value: JSON.stringify(sessions.find(s => s.pid === pid)) }
  })
  on('process.run', ($, e) => {
    const done = (exitCode: number, stdout = '') => ({
      value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    })
    if (e.argv[0] === 'kill') return done(dead.includes(Number(e.argv[2])) ? 1 : 0)
    const dirs = e.argv.filter((_, i) => e.argv[i - 1] === '-C')
    const last = dirs.at(-1) ?? '/repo'
    return done(0, last.startsWith('/repo-wt') ? '/repo-wt\n' : '/repo\n')
  })
  on('tool.call', () => ({ result: { stdout: 'ran' } }))
}

const OTHER: Session = { pid: 11, sessionId: 'other', cwd: '/repo', name: 'argo-cd-3d', status: 'busy' }

test('blocks a branch switch while another session shares the checkout', async ($, on) => {
  machine(on, [OTHER])
  const ran = await $.tool.call({ tool: 'Bash', command: 'git checkout -b feat/x' })
  expect(ran.deny).toContain('argo-cd-3d')
})

test('lets read-only git through while another session shares the checkout', async ($, on) => {
  machine(on, [OTHER])
  const ran = await $.tool.call({ tool: 'Bash', command: 'git status && git stash list' })
  expect(ran.deny).toBeUndefined()
})

test('allows a branch switch when this session is the only one here', async ($, on) => {
  machine(on, [{ ...OTHER, sessionId: 'me' }])
  const ran = await $.tool.call({ tool: 'Bash', command: 'git switch master' })
  expect(ran.deny).toBeUndefined()
})

test('ignores a session whose process has exited', async ($, on) => {
  machine(on, [OTHER], [OTHER.pid])
  const ran = await $.tool.call({ tool: 'Bash', command: 'git reset --hard' })
  expect(ran.deny).toBeUndefined()
})

test('allows a branch switch in another worktree', async ($, on) => {
  machine(on, [OTHER])
  const ran = await $.tool.call({ tool: 'Bash', command: 'cd /repo-wt && git checkout master' })
  expect(ran.deny).toBeUndefined()
})

test('shows the band with the other session once it has blocked', async ($, on) => {
  machine(on, [OTHER])
  on('ui.render', ($, e) => h($.ui.resolve(e).Box, {}) as RenderElement)
  await $.tool.call({ tool: 'Bash', command: 'git rebase master' })
  const ui = await $.ui.mount({
    plugin: 'checkout-guard',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 4,
      bodyColumns: 160,
      scroll: { offset: 0, bodyRows: 4 },
      view: {},
    },
    viewport: { columns: 160, rows: 40 },
  })
  expect(await ui.find({ type: 'Text', text: /argo-cd-3d \(busy\)/ })).toBeDefined()
  await ui.press({ key: 'dismiss' })
  expect(await ui.find({ key: 'dismiss' })).toBeUndefined()
})

describe('gitCallsThatChangeCheckout', () => {
  const subcommands = (command: string) =>
    gitCallsThatChangeCheckout(command, '/home/u').map(c => c.subcommand)

  test('finds the calls that move the branch or discard files', () => {
    expect(subcommands('git checkout main')).toEqual(['checkout'])
    expect(subcommands('git stash')).toEqual(['stash'])
    expect(subcommands('git stash pop')).toEqual(['stash'])
    expect(subcommands('git reset --hard HEAD~1')).toEqual(['reset'])
    expect(subcommands('git clean -fd')).toEqual(['clean'])
    expect(subcommands('git restore foo.go')).toEqual(['restore'])
    expect(subcommands('git fetch && git rebase origin/master')).toEqual(['rebase'])
  })

  test('leaves read-only and staging calls alone', () => {
    expect(subcommands('git status')).toEqual([])
    expect(subcommands('git checkout --help')).toEqual([])
    expect(subcommands('git stash list')).toEqual([])
    expect(subcommands('git reset HEAD foo.go')).toEqual([])
    expect(subcommands('git clean -n')).toEqual([])
    expect(subcommands('git restore --staged foo.go')).toEqual([])
    expect(subcommands('echo "git checkout main"')).toEqual([])
    expect(subcommands('git commit -m "undo git checkout"')).toEqual([])
  })

  test('follows cd and -C to the directory git runs in', () => {
    const [call] = gitCallsThatChangeCheckout('cd ~/wt && git -C sub checkout x', '/home/u')
    expect(call?.dirs).toEqual(['/home/u/wt', 'sub'])
  })
})
