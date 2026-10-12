import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { age, sessionNameForPr } from '../hooks/names'

type Entry = { sessionId: string; name: string; nameSource: string }
type File = { name: string; mtimeMs: number }

// A session `me` in a checkout of argo-cd, its registry row `entry`, with
// `handoffs` in the handoff folder. Collects the commands and prompts the mod runs.
function machine(on: On, entry: Entry, handoffs: File[] = []) {
  const ran = { renames: [] as string[], prompts: [] as string[] }

  mock.env(on, { HOME: '/home/u' })
  on('session.id', () => ({ value: 'me' }))
  on('session.cwd', () => ({ value: '/src/argo-cd' }))
  on('fs.list', ($, e) => ({
    value: e.path?.endsWith('/sessions')
      ? [{ name: '1.json', kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false }]
      : handoffs.map(f => ({ ...f, kind: 'file' as const, size: 1, isLink: false })),
  }))
  on('fs.read', () => ({ value: JSON.stringify(entry) }))
  on('process.run', ($, e) => ({
    value: {
      exitCode: 0,
      stdout: e.argv.includes('--git-common-dir') ? '/src/argo-cd/.git\n' : '',
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))
  on('prompt.submit', ($, e) => {
    ran.prompts.push(e.text)
    return { text: e.text }
  })
  on('turn.complete', () => ({ text: '', reason: 'answer' as const }))
  on('command.run', ($, e) => {
    if (e.command === 'rename') ran.renames.push(e.args)
    return { text: '' }
  })

  return ran
}

const DERIVED: Entry = { sessionId: 'me', name: 'argo-cd-e4', nameSource: 'derived' }

async function turn($: Engine, text: string) {
  await $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } } as never)
  await $.turn.complete({ answer: '', text: '', reason: 'answer', turnId: 't' } as never)
}

test('renames the session after the first PR it is asked about', async ($, on) => {
  const clock = mock.clock(on)
  const ran = machine(on, DERIVED)

  await turn($, '@"pr-review (agent)" https://github.com/argoproj/argo-cd/pull/29768')
  await clock.advance(1)
  await turn($, 'what about https://github.com/argoproj/argo-cd/pull/30019')
  await clock.advance(1)

  expect(ran.renames).toEqual(['pr-argo-cd-29768'])
})

test('keeps a name the user gave the session', async ($, on) => {
  const clock = mock.clock(on)
  const ran = machine(on, { ...DERIVED, name: '28667', nameSource: 'user' })

  await turn($, 'review argoproj/argo-cd/pull/29477')
  await clock.advance(1)

  expect(ran.renames).toEqual([])
})

test('/handoff asks for the handoff file under the repo folder', async ($, on) => {
  const clock = mock.clock(on)
  const ran = machine(on, DERIVED)

  const out = await $.command.run({ command: 'handoff', args: 'waiting on CI' } as never)
  await clock.advance(1)

  expect(out.text).toContain('/home/u/.claude/handoffs/argo-cd/argo-cd-e4.md')
  expect(ran.prompts.at(-1)).toContain('# Handoff: argo-cd-e4')
  expect(ran.prompts.at(-1)).toContain('waiting on CI')
})

test('/resume-handoff lists the newest first and loads by number', async ($, on) => {
  const clock = mock.clock(on, { now: 3 * 3_600_000 })
  const ran = machine(on, DERIVED, [
    { name: 'pr-argo-cd-28667.md', mtimeMs: 0 },
    { name: 'pr-argo-cd-29768.md', mtimeMs: 2 * 3_600_000 },
  ])

  const list = await $.command.run({ command: 'resume-handoff', args: '' } as never)
  expect(list.text).toContain('1. pr-argo-cd-29768 (1h ago)')
  expect(list.text).toContain('2. pr-argo-cd-28667 (3h ago)')

  await $.command.run({ command: 'resume-handoff', args: '2' } as never)
  await clock.advance(1)
  expect(ran.prompts.at(-1)).toContain('/home/u/.claude/handoffs/argo-cd/pr-argo-cd-28667.md')
})

describe('sessionNameForPr', () => {
  test('names a PR from a URL or the owner/repo/pull form', () => {
    expect(sessionNameForPr('https://github.com/argoproj/argo-cd/pull/29768')).toBe('pr-argo-cd-29768')
    expect(sessionNameForPr('review argoproj/argo-cd/pull/29477 please')).toBe('pr-argo-cd-29477')
    expect(sessionNameForPr('see https://github.com/argoproj/argo-cd/pull/29744/changes#r1')).toBe(
      'pr-argo-cd-29744',
    )
  })

  test('takes the first PR when a prompt names several', () => {
    expect(
      sessionNameForPr('do https://github.com/a/one/pull/1 and https://github.com/b/two/pull/2 overlap'),
    ).toBe('pr-one-1')
  })

  test('ignores text without a PR', () => {
    expect(sessionNameForPr('https://github.com/argoproj/argo-cd/actions/runs/35035361308')).toBeUndefined()
    expect(sessionNameForPr('look at #29768')).toBeUndefined()
  })

  test('says how long ago in minutes, hours, then days', () => {
    expect(age(5 * 60_000)).toBe('5m ago')
    expect(age(3 * 3_600_000)).toBe('3h ago')
    expect(age(72 * 3_600_000)).toBe('3d ago')
  })
})
