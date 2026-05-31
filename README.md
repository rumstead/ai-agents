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

- `code-quality-review`
- `issue-alignment`
- `performance-review`

## Install

```bash
./install.sh
```

This symlinks:

| Repo folder | Linked into |
|-------------|-------------|
| `agents/` | `~/.config/Code/User/prompts/` (VS Code) and `~/.config/copilot/agents/` (Copilot CLI) |
| `skills/` | `~/.copilot/skills/` |

