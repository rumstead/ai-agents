---
name: issue-alignment
description: "Analyze whether PR changes fully address a GitHub issue's requirements. Use when: checking PR-to-issue alignment, verifying acceptance criteria coverage, detecting scope creep or missing deliverables."
user-invocable: false
---

# Issue Alignment Analysis

## When to Use

- Verify a PR fully addresses the linked GitHub issue
- Detect missing requirements or scope creep
- Validate acceptance criteria coverage

## Procedure

### 1. Extract Issue Requirements

Apply the following decision tree before extraction:
1. If no issue is linked → output "Alignment analysis cannot be performed: no linked issue found." and stop.
2. If the issue has no acceptance criteria and no structured requirements → extract implicit requirements from the title and description, and prepend a note in the output: "⚠️ No explicit acceptance criteria found; requirements inferred from title and description."
3. Otherwise → proceed to extraction below.

From the GitHub issue, extract:
- **Title and description**: The core ask
- **Acceptance criteria**: Explicit checkboxes or listed requirements
- **Discussion context**: Clarifications, edge cases, and scope refinements mentioned in comments
- **Labels/milestones**: Scope hints (bug fix, feature, refactor)

Organize requirements into a checklist:

```markdown
- [ ] Requirement 1 (from description)
- [ ] Requirement 2 (from acceptance criteria)
- [ ] Requirement 3 (from comments)
```

### 2. Map Changes to Requirements

If no PR diff or changed-file list is available in context, state: "PR changes could not be retrieved; requirements coverage and scope analysis cannot be completed. Please provide the diff or file list." and stop.

For each file changed in the PR:
1. Identify which requirement(s) it addresses
2. Flag as scope creep any changed file whose purpose cannot be traced to a stated or implicit requirement in the issue. Exclude pure formatting changes, dependency version bumps, and changes explicitly described as follow-on cleanup in the PR description — note those separately as out-of-scope but low-risk.

### 3. Gap Analysis

Check for:

| Check | What to Look For |
|-------|-----------------|
| **Missing requirements** | Issue requirements with no corresponding code changes |
| **Partial implementations** | Mark a requirement as ⚠️ Partial when the core behavior is present but directly related error paths are absent. Record missing error handling as an Implicit Requirement gap only when it belongs to a new code path that has no corresponding requirement at all. |
| **Scope creep** | Changes that go beyond the issue scope without justification |
| **Implicit requirements** | Test coverage for new/changed behavior, error handling for new code paths, documentation updates for user-facing changes |
| **Regression risk** | Changes that might break existing behavior mentioned in the issue |

### 4. Output Format

Scope issue severity: **High** = missing or wrong behavior that would cause the issue's stated goal to be unmet or a regression; **Medium** = gap that reduces quality or coverage but does not block the goal (e.g., missing tests, missing docs); **Low** = cosmetic or trivially reversible deviation (e.g., unrelated rename).

For Evidence, cite the single most authoritative file and line range. If a requirement spans multiple files, list up to three locations separated by commas; if more than three, list the primary implementation file and append "+ N more".

If the PR is linked to multiple issues, produce one ## Issue Alignment Summary section per linked item, each with its own Requirements Coverage and Scope Issues tables. List the overall verdict for the PR as the lowest verdict across all sections.

Return findings as:

```markdown
## Issue Alignment Summary

**Issue**: #<number> - <title>
**Verdict**: ✅ Fully Aligned | ⚠️ Partially Aligned | ❌ Misaligned
<!-- If the linked issue is closed as "won't fix" or "by design", or if the PR description explicitly states a deliberate scope change, note this context after the Verdict line and adjust gap severity accordingly. -->

### Requirements Coverage

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | <requirement> | ✅ Addressed | <file:lines> |
| 2 | <requirement> | ⚠️ Partial | <what's missing> |
| 3 | <requirement> | ❌ Missing | <no changes found> |

### Scope Issues

| # | Severity | Type | File | Description |
|---|----------|------|------|-------------|
| 1 | Medium | Scope Creep | path/file.go | Refactored X which is unrelated to the issue |
| 2 | High | Missing | - | No test coverage for new behavior |
```
