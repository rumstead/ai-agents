import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'

import { formatInfo, shortModel } from '../hooks/format'

// A session in a checkout of argo-cd on master, kubectl pointed at
// `admin@talos`, and the settings giving opus high effort. Hands back what the
// plugin passes the engine as the hint line's tail.
function machine(on: On, kubeContext: string | null = 'admin@talos') {
  const hint = { tail: undefined as string | undefined }
  on('ui.render', ($, e) => {
    hint.tail = (e.props as { tail?: string }).tail
    return h($.ui.resolve(e).Text, {}, 'hint') as RenderElement
  })
  const out = (stdout: string, exitCode = 0) => ({
    value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  })
  on('process.run', ($, e) => {
    if (e.argv[0] === 'kubectl') return kubeContext === null ? out('', 1) : out(`${kubeContext}\n`)
    if (e.argv.includes('--git-common-dir')) return out('/src/argo-cd/.git\n')
    if (e.argv.includes('--show-current')) return out('master\n')
    return out('', 1)
  })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('settings.read', () => ({
    value: { modelSettings: { 'claude-opus-5-5': { effortLevel: 'high' } } },
  }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  return hint
}

async function drawHint($: Engine): Promise<void> {
  const ui = await $.ui.mount({
    plugin: 'session-info',
    surface: 'terminal',
    component: 'PromptHint',
    props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
    viewport: { columns: 160, rows: 40 },
  })
  await ui.unmount()
}

test('adds the repo, kube context, model, and effort to the hint line', async ($, on) => {
  const clock = mock.clock(on)
  const hint = machine(on)

  await $.session.start({ cwd: '/src/argo-cd', surface: 'terminal' } as never)
  await clock.advance(1)

  await drawHint($)
  expect(hint.tail).toBe('argo-cd:master · k8s:admin@talos · opus-5-5 high')
})

test('leaves out the kube context when kubectl has none', async ($, on) => {
  const clock = mock.clock(on)
  const hint = machine(on, null)

  await $.session.start({ cwd: '/src/argo-cd', surface: 'terminal' } as never)
  await clock.advance(1)

  await drawHint($)
  expect(hint.tail).toBe('argo-cd:master · opus-5-5 high')
})

test('leaves the hint line alone before anything is known', async ($, on) => {
  const hint = machine(on)

  await drawHint($)
  expect(hint.tail).toBeUndefined()
})

describe('format', () => {
  test('shortens model ids', () => {
    expect(shortModel('claude-opus-5-5')).toBe('opus-5-5')
    expect(shortModel('claude-haiku-4-5-20251001')).toBe('haiku-4-5')
  })

  test('joins what is known', () => {
    expect(formatInfo({ repo: 'homelab', kubeContext: null, model: 'opus-5-5', effort: null })).toBe(
      'homelab · opus-5-5',
    )
  })
})
