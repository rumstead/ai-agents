import type { Info } from '../types'

export function shortModel(model: string): string {
  return model.replace(/^claude-/, '').replace(/-\d{8}$/, '')
}

// `argo-cd:master · k8s:admin@talos · opus-5-5 high`, leaving out what is unknown.
export function formatInfo(info: Info): string {
  const model = [info.model, info.effort].filter(Boolean).join(' ')
  return [info.repo, info.kubeContext && `k8s:${info.kubeContext}`, model]
    .filter(Boolean)
    .join(' · ')
}
