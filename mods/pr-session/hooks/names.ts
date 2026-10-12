// `github.com/<owner>/<repo>/pull/<n>`, or the bare `<owner>/<repo>/pull/<n>`.
const PR = /(?:^|[\s(<"'`/])(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)/

export function sessionNameForPr(text: string): string | undefined {
  const match = PR.exec(text)
  if (match === null) return undefined

  const repo = match[2]!.toLowerCase().replace(/\.git$/, '')
  return `pr-${repo}-${match[3]}`
}

export function age(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function today(ms: number): string {
  const date = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
