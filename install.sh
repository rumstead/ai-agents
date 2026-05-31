#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VSCODE_PROMPTS="$HOME/.config/Code/User/prompts"
CLI_AGENTS="$HOME/.config/copilot/agents"
SKILLS_DIR="$HOME/.copilot/skills"

mkdir -p "$VSCODE_PROMPTS" "$CLI_AGENTS" "$SKILLS_DIR"

link() { ln -sfn "$1" "$2/$(basename "$1")"; }

# Agents -> VS Code prompts + Copilot CLI agents
for f in "$REPO_DIR"/agents/*.agent.md; do
  [ -e "$f" ] || continue
  link "$f" "$VSCODE_PROMPTS"
  link "$f" "$CLI_AGENTS"
done

# Skills -> shared skills dir
for d in "$REPO_DIR"/skills/*/; do
  [ -d "$d" ] || continue
  ln -sfn "${d%/}" "$SKILLS_DIR/$(basename "$d")"
done

echo "Linked agents and skills from $REPO_DIR"
