# ai-agents

Personal collection of AI coding **subagents** and **skills**, kept in one place
so they can be versioned, shared, and reused across AI coding harnesses.

## Structure

```
ai-agents/
├── install.sh        # symlinks agents and skills into their live locations
├── agents/           # *.agent.md subagents
└── skills/           # one folder per skill, each containing a SKILL.md
```

## Contents

### Agents

| Agent | Purpose |
|-------|---------|
| `pr-code-quality` | Reviews idioms, style consistency, design patterns, architectural fit |
| `pr-issue-alignment` | Verifies PR changes align with a GitHub issue's requirements |
| `pr-performance` | Finds performance bottlenecks, scalability and concurrency risks |
| `pr-review` | Comprehensive PR review orchestrating the above |

### Skills

| Skill | Description |
|-------|-------------|
| `code-quality-review` | Evaluate code idioms, style, design patterns, and architectural fit |
| `issue-alignment` | Verify PR changes align with a GitHub issue's requirements |
| `performance-review` | Find performance bottlenecks, scalability and concurrency risks |
| `writing-as-rumstead` | My writing voice for anything posted under my name (PR comments, commits, docs) |

### Always-on instructions

A skill whose frontmatter carries `applyTo:` is personal *context* (voice, style,
standing preferences) rather than a procedure to run on request. Claude Code
discovers it by `description` at run time like any other skill, but Copilot has no
on-demand skill discovery, so `install.sh` also generates an always-on
`<name>.instructions.md` for it in the VS Code prompts directories (local and
Remote). `writing-as-rumstead` is the only such skill today.

Note that Claude Code will only consult it when the task looks like writing under
my name. Rules that must apply to *every* reply (no em dashes) belong in
`~/.claude/CLAUDE.md`, which is loaded into every session.

## Portability across harnesses

The canonical source of truth is the files in this repo:

- `agents/*.agent.md` — agent prompt bodies with Copilot-style frontmatter
- `skills/*/SKILL.md` — reusable skill procedures

The **prompt bodies and skills are plain Markdown** and transfer across harnesses
unchanged. Only the agent *frontmatter* is harness-specific:

| | GitHub Copilot | Claude Code | Windsurf |
|---|---|---|---|
| Agent file | `*.agent.md` | `*.md` | `*.md` (workflow) |
| `tools` field | `[read, search, web, execute, agent]` | `Read, Grep, Glob, WebFetch, WebSearch, Bash` | — |
| Delegation | `agents:` + skill IDs | main-thread subagents + model-invoked skills | — |

`install.sh` handles this: Copilot and Windsurf consume the canonical files via
symlink, while for Claude Code it **generates** adapted subagents (rewriting the
`tools` list to Claude Code's PascalCase tool names, dropping Copilot-only keys,
and using `<name>.md` filenames). The comprehensive review workflow includes a
direct skill-based fallback for harnesses without nested delegation, and a
GitHub CLI fallback for harnesses without GitHub-native tools.

## Install

```bash
./install.sh
```

This installs into each harness's live locations:

| Harness | Agents | Skills |
|---------|--------|--------|
| **GitHub Copilot** | `~/Library/Application Support/Code/User/prompts/` on macOS or `~/.config/Code/User/prompts/` elsewhere (VS Code), `~/.config/copilot/agents/` and `~/.copilot/agents/` (CLI) — symlinked | `~/.copilot/skills/` — symlinked |
| **Windsurf** | `~/.codeium/windsurf/global_workflows/` — symlinked | (delivered as workflows) |
| **Claude Code** | `~/.claude/agents/` — generated | `~/.claude/skills/` — symlinked |

Plus `~/.config/Code/User/prompts/` and `~/.vscode-server/data/User/prompts/`
(generated `*.instructions.md` for any skill marked `applyTo:`).
