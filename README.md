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
and using `<name>.md` filenames). The prompt bodies are never modified — Claude
Code discovers the referenced skills by their `description` at run time.

## Install

```bash
./install.sh
```

This installs into each harness's live locations:

| Harness | Agents | Skills |
|---------|--------|--------|
| **GitHub Copilot** | `~/.config/Code/User/prompts/` (VS Code), `~/.config/copilot/agents/` and `~/.copilot/agents/` (CLI) — symlinked | `~/.copilot/skills/` — symlinked |
| **Windsurf** | `~/.codeium/windsurf/global_workflows/` — symlinked | (delivered as workflows) |
| **Claude Code** | `~/.claude/agents/` — generated | `~/.claude/skills/` — symlinked |
