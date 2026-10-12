#!/usr/bin/env bash
set -euo pipefail

# Installs the agents and skills from this repo into the live locations used by
# the supported AI coding harnesses.
#
# The canonical source of truth is:
#   agents/*.agent.md   — agent prompt bodies with Copilot-style frontmatter
#   skills/*/SKILL.md   — reusable skill procedures
#   mods/*/             Claude Code plugins of function hooks, listed in
#                       .claude-plugin/marketplace.json
#
# Copilot and Windsurf consume the canonical files directly (via symlink).
# Claude Code uses a different frontmatter dialect (PascalCase `tools` string,
# `<name>.md` filenames, no nested `agents:`/`user-invocable`), so for Claude
# Code we GENERATE adapted copies rather than symlinking. The prompt bodies —
# including the "follow the <skill> skill" instructions — are left untouched;
# Claude Code discovers those skills by description at run time.

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---- Harness target locations -------------------------------------------------

# GitHub Copilot
if [[ "$(uname -s)" == "Darwin" ]]; then
  VSCODE_PROMPTS="$HOME/Library/Application Support/Code/User/prompts"
else
  VSCODE_PROMPTS="$HOME/.config/Code/User/prompts"
fi
CLI_AGENTS="$HOME/.config/copilot/agents"          # Copilot CLI (XDG location)
DEFAULT_AGENTS="$HOME/.copilot/agents"             # Copilot CLI (default location)
COPILOT_SKILLS="$HOME/.copilot/skills"
VSCODE_SERVER_PROMPTS="$HOME/.vscode-server/data/User/prompts"  # VS Code Remote

# Windsurf (Cascade) — workflows live under the Codeium global dir. Windsurf has
# no native subagent/skill split, so both agents and skills land as workflows.
WINDSURF_DIR="$HOME/.codeium/windsurf/global_workflows"

# Claude Code — native subagents and skills.
CLAUDE_AGENTS="$HOME/.claude/agents"
CLAUDE_SKILLS="$HOME/.claude/skills"

mkdir -p \
  "$VSCODE_PROMPTS" "$CLI_AGENTS" "$DEFAULT_AGENTS" "$COPILOT_SKILLS" \
  "$VSCODE_SERVER_PROMPTS" \
  "$WINDSURF_DIR" \
  "$CLAUDE_AGENTS" "$CLAUDE_SKILLS"

link() { ln -sfn "$1" "$2/$(basename "$1")"; }

# ---- Frontmatter adapter: Copilot agent -> Claude Code subagent ---------------
#
# Reads a *.agent.md file on stdin and writes a Claude Code subagent to stdout:
#   - ensures a `name:` field (derived from the filename if absent)
#   - rewrites `tools: [read, search, ...]` to a PascalCase comma string
#       read->Read, search->Grep+Glob, web->WebFetch+WebSearch, execute->Bash,
#       agent->Agent, github/*->the mcp__github__ tools the PR agents call
#   - drops Copilot-only frontmatter keys (agents, user-invocable, argument-hint)
#   - leaves the Markdown body verbatim
to_claude_agent() {
  local name="$1"
  awk -v name="$name" '
    function flush_tools() {
      if (!tools_seen) return
      # Map Copilot tool tokens to Claude Code tool names.
      out = ""
      n = split(tools_raw, t, /[][, ]+/)
      delete have
      for (i = 1; i <= n; i++) {
        tok = t[i]
        gsub(/["'\'']/, "", tok)   # tokens may be quoted, e.g. "github/*"
        if (tok == "")        continue
        else if (tok == "read")    add("Read")
        else if (tok == "search")  { add("Grep"); add("Glob") }
        else if (tok == "web")     { add("WebFetch"); add("WebSearch") }
        else if (tok == "execute") add("Bash")
        else if (tok == "agent")   add("Agent")
        else if (tok ~ /^github/) {
          # Claude Code needs each MCP tool named; there is no server wildcard.
          add("mcp__github__pull_request_read")
          add("mcp__github__issue_read")
          add("mcp__github__list_commits")
          add("mcp__github__pull_request_review_write")
          add("mcp__github__add_comment_to_pending_review")
        }
        # Anything unknown is intentionally skipped.
      }
      if (out != "") print "tools: " out
    }
    function add(x) {
      if (have[x]) return
      have[x] = 1
      out = (out == "") ? x : out ", " x
    }
    BEGIN { in_fm = 0; fm_done = 0; tools_seen = 0; name_seen = 0 }
    NR == 1 && $0 == "---" { in_fm = 1; print; print "name: " name; name_used = 1; next }
    in_fm && $0 == "---" {
      # Closing fence: emit collected tools, then close.
      flush_tools()
      in_fm = 0; fm_done = 1
      print
      next
    }
    in_fm {
      # Collect a (possibly multi-line) tools value.
      if (collecting_tools) {
        tools_raw = tools_raw " " $0
        if ($0 ~ /]/) collecting_tools = 0
        next
      }
      if ($0 ~ /^name:/) {
        if (name_used) next   # we already printed our own name
        name_seen = 1; print; next
      }
      if ($0 ~ /^tools:/) {
        tools_seen = 1
        tools_raw = $0
        if ($0 !~ /]/ && $0 ~ /\[/) collecting_tools = 1
        next
      }
      # Drop Copilot-only keys.
      if ($0 ~ /^(agents|user-invocable|argument-hint):/) next
      print
      next
    }
    { print }
  '
}

# ---- Frontmatter adapter: skill -> Copilot custom instructions ----------------
#
# A skill whose frontmatter carries `applyTo:` is personal *context* (voice,
# style, standing preferences) rather than a procedure to run on request. Copilot
# has no on-demand skill discovery, so those are also emitted as an always-on
# `<name>.instructions.md`. Claude Code needs no equivalent: it discovers the
# skill by its `description` at run time.
#
# Reads SKILL.md on stdin, writes the instructions file on stdout:
#   - keeps `description:` and `applyTo:`, drops `name:` and `user-invocable:`
#   - leaves the Markdown body verbatim
to_copilot_instructions() {
  awk '
    BEGIN { in_fm = 0 }
    NR == 1 && $0 == "---" { in_fm = 1; print; next }
    in_fm && $0 == "---"   { in_fm = 0; print; next }
    in_fm {
      if ($0 ~ /^(name|user-invocable):/) next
      print
      next
    }
    { print }
  '
}

# ---- Agents -------------------------------------------------------------------
for f in "$REPO_DIR"/agents/*.agent.md; do
  [ -e "$f" ] || continue
  base="$(basename "$f")"            # e.g. pr-review.agent.md
  name="${base%.agent.md}"           # e.g. pr-review

  # Copilot: symlink the canonical file as-is.
  link "$f" "$VSCODE_PROMPTS"
  link "$f" "$CLI_AGENTS"
  link "$f" "$DEFAULT_AGENTS"

  # Windsurf: workflows are plain markdown; reuse the canonical file.
  link "$f" "$WINDSURF_DIR"

  # Claude Code: generate an adapted subagent at ~/.claude/agents/<name>.md
  to_claude_agent "$name" < "$f" > "$CLAUDE_AGENTS/$name.md"
done

# ---- Skills -------------------------------------------------------------------
# Skill bodies are plain procedures and are portable verbatim. Copilot and
# Claude Code both read skills/<id>/SKILL.md (name + description frontmatter),
# so we symlink the skill directories into each harness's skills location.
for d in "$REPO_DIR"/skills/*/; do
  [ -d "$d" ] || continue
  name="$(basename "$d")"
  ln -sfn "${d%/}" "$COPILOT_SKILLS/$name"
  ln -sfn "${d%/}" "$CLAUDE_SKILLS/$name"

  # Skills marked `applyTo:` double as Copilot always-on custom instructions.
  if [ -f "${d}SKILL.md" ] && grep -q '^applyTo:' "${d}SKILL.md"; then
    to_copilot_instructions < "${d}SKILL.md" > "$VSCODE_PROMPTS/$name.instructions.md"
    to_copilot_instructions < "${d}SKILL.md" > "$VSCODE_SERVER_PROMPTS/$name.instructions.md"
  fi
done

# ---- Mods ---------------------------------------------------------------------
# Claude Code only. The repo is a local plugin marketplace, so each mod is
# installed at user scope and read in place from mods/<name>: an edit there
# takes effect at the next session start or /reload-plugins. Every step here is
# safe to rerun, and `marketplace update` picks up a mod newly added to
# .claude-plugin/marketplace.json.
MARKETPLACE="$(jq -r .name "$REPO_DIR/.claude-plugin/marketplace.json")"
MODS=()
if command -v claude >/dev/null; then
  claude plugin marketplace add "$REPO_DIR" >/dev/null
  claude plugin marketplace update "$MARKETPLACE" >/dev/null
  for name in $(jq -r '.plugins[].name' "$REPO_DIR/.claude-plugin/marketplace.json"); do
    claude plugin install "$name@$MARKETPLACE" --scope user >/dev/null
    MODS+=("$name")
  done
else
  echo "claude not found, skipping mods" >&2
fi

echo "Installed agents and skills from $REPO_DIR"
echo "  Copilot   : $VSCODE_PROMPTS, $CLI_AGENTS, $DEFAULT_AGENTS (+ skills in $COPILOT_SKILLS)"
echo "  Instrucns : $VSCODE_PROMPTS, $VSCODE_SERVER_PROMPTS (generated from applyTo skills)"
echo "  Windsurf  : $WINDSURF_DIR"
echo "  ClaudeCode: $CLAUDE_AGENTS (generated) + skills in $CLAUDE_SKILLS"
echo "  Mods      : ${MODS[*]:-none} (user scope, marketplace $MARKETPLACE)"
