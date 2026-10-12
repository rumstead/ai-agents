// A git call in a shell command that changes the branch or the files of the
// checkout it runs in. `dirs` is the chain of `cd` and `-C` directories in
// front of it, in order, each relative to the one before.
export type GitCall = { dirs: string[]; subcommand: string; args: string[] }

const SEPARATORS = /&&|\|\||[;|\n(){}]|\$\(/
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
const PREFIXES = new Set(['command', 'exec', 'time', 'nohup', 'env'])

const unquote = (word: string) => word.replace(/^(['"])(.*)\1$/, '$2')

const expandHome = (path: string, home: string) =>
  path === '~' ? home : path.startsWith('~/') ? home + path.slice(1) : path

export function changesCheckout(subcommand: string, args: string[]): boolean {
  if (args.some(a => a === '--help' || a === '-h')) return false

  switch (subcommand) {
    case 'checkout':
    case 'switch':
    case 'rebase':
    case 'pull':
    case 'merge':
      return true
    case 'stash':
      return !['list', 'show'].includes(args[0] ?? '')
    case 'reset':
      return args.some(a => ['--hard', '--merge', '--keep'].includes(a))
    case 'clean':
      return !args.some(a => a === '--dry-run' || /^-[a-zA-Z]*n/.test(a))
    case 'restore': {
      const isStaged = args.some(a => a === '--staged' || /^-[a-zA-Z]*S/.test(a))
      const isWorktree = args.some(a => a === '--worktree' || /^-[a-zA-Z]*W/.test(a))
      return !isStaged || isWorktree
    }
    default:
      return false
  }
}

export function gitCallsThatChangeCheckout(command: string, home: string): GitCall[] {
  const found: GitCall[] = []
  const cds: string[] = []

  for (const segment of command.split(SEPARATORS)) {
    const words = segment.trim().split(/\s+/).filter(Boolean).map(unquote)
    while (words.length > 0 && (ASSIGNMENT.test(words[0]!) || PREFIXES.has(words[0]!))) {
      words.shift()
    }

    if (words[0] === 'cd') {
      const target = words[1]
      if (target === undefined) cds.push(home)
      else if (target !== '-') cds.push(expandHome(target, home))
      continue
    }
    if (words[0] !== 'git') continue

    const dirs = [...cds]
    let i = 1
    while (i < words.length && words[i]!.startsWith('-')) {
      const option = words[i]!
      if (option === '-C') {
        dirs.push(expandHome(words[i + 1] ?? '.', home))
        i += 2
      } else if (option === '-c') {
        i += 2
      } else {
        i += 1
      }
    }
    const subcommand = words[i]
    const args = words.slice(i + 1)
    if (subcommand !== undefined && changesCheckout(subcommand, args)) {
      found.push({ dirs, subcommand, args })
    }
  }

  return found
}
