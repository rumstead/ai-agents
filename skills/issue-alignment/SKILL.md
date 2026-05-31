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

From the GitHub issue, extract:
- **Title and description**: The core ask
- **Acceptance criteria**: Explicit checkboxes or listed requirements
- **Discussion context**: Clarifications, edge cases mentioned in comments
- **Labels/milestones**: Scope hints (bug fix, feature, refactor)

Organize requirements into a checklist:

```markdown
- [ ] Requirement 1 (from description)
- [ ] Requirement 2 (from acceptance criteria)
- [ ] Requirement 3 (clarified in comments)
```

### 2. Map Changes to Requirements

For each file changed in the PR:
1. Identify which requirement(s) it addresses
2. Note if any changes don't map to a requirement (potential scope creep)

### 3. Gap Analysis

Check for:

| Check | What to Look For |
|-------|-----------------|
| **Missing requirements** | Issue requirements with no corresponding code changes |
| **Partial implementations** | Requirements only partially addressed (e.g., happy path but no error handling) |
| **Scope creep** | Changes that go beyond the issue scope without justification |
| **Implicit requirements** | Obvious needs not stated (e.g., issue says "add endpoint" but no tests) |
| **Regression risk** | Changes that might break existing behavior mentioned in the issue |

### 4. Output Format

Return findings as:

```markdown
## Issue Alignment Summary

**Issue**: #<number> - <title>
**Verdict**: ✅ Fully Aligned | ⚠️ Partially Aligned | ❌ Misaligned

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
