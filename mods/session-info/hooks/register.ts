import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Info } from '../types'
import { formatInfo, shortModel } from './format'

const info = atom(
  { plugin: 'session-info', key: 'info' } as const,
  { repo: null, kubeContext: null, model: null, effort: null },
)

const REFRESH_MS = 15_000

async function run($: EngineInterface, argv: string[]): Promise<string | null> {
  const ran = await $.process.run(argv, { timeoutMs: 5_000 }).catch(() => undefined)
  const out = ran?.exitCode === 0 ? ran.stdout.trim() : ''
  return out === '' ? null : out
}

// `<repo>:<branch>`, the repo named the same from any of its worktrees.
async function repo($: EngineInterface): Promise<string | null> {
  const common = await run($, ['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'])
  if (common === null) return null

  const name = common.replace(/\/\.git\/?$/, '').split('/').filter(Boolean).pop() ?? null
  const branch = await run($, ['git', 'branch', '--show-current'])
  return branch === null ? name : `${name}:${branch}`
}

// The effort the settings give the model, until a request says otherwise.
async function configuredEffort($: EngineInterface, model: string): Promise<string | null> {
  const settings = (await $.settings.read()) as {
    effortLevel?: string
    modelSettings?: Record<string, { effortLevel?: string }>
  }
  return settings.modelSettings?.[model]?.effortLevel ?? settings.effortLevel ?? null
}

async function refresh($: EngineInterface, options: { effort?: boolean } = {}): Promise<void> {
  const [repoName, kubeContext, model] = await Promise.all([
    repo($),
    run($, ['kubectl', 'config', 'current-context']),
    $.session.model(),
  ])
  const effort = options.effort ? await configuredEffort($, model) : undefined

  await update($, info, (now): Info => ({
    repo: repoName,
    kubeContext,
    model: shortModel(model),
    effort: effort === undefined ? now.effort : effort,
  }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    void refresh($, { effort: true })
    $.clock.every(REFRESH_MS, () => void refresh($))

    return started
  })

  on('prompt.submit', async ($, e, next) => {
    void refresh($)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) void refresh($)

    return done
  })

  // /model and /effort change what the next request sends.
  on('command.run', async ($, e, next) => {
    const ran = await next(e)
    if (e.command === 'model' || e.command === 'effort') void refresh($, { effort: true })

    return ran
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      const effort = e.effort === undefined ? null : String(e.effort)
      const model = shortModel(e.model)
      await update($, info, now => ({ ...now, model, effort }))
    }

    return yield* next(e)
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const tail = formatInfo(await read($, info))

    return tail === '' ? next(e) : next({ ...e, props: { ...e.props, tail } })
  })
}
