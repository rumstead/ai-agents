---
name: code-quality-review
description: "Evaluate code for language idioms, style consistency, design patterns, and architectural fit. Use when: reviewing code style, checking idiomatic usage, evaluating design patterns, assessing how code fits into existing codebase."
user-invocable: false
---

# Code Quality Review

## When to Use

- Evaluate whether new code follows language idioms
- Check style consistency with the existing codebase
- Assess design pattern usage and architectural fit
- Identify maintainability concerns

## Procedure

### 1. Establish Codebase Conventions

Before reviewing, sample the existing codebase to understand:
- **Naming conventions**: camelCase vs snake_case, prefixes, suffixes
- **File organization**: Module structure, where things live
- **Error handling patterns**: How errors propagate, custom types
- **Abstraction style**: Interfaces vs concrete types, inheritance depth
- **Import organization**: Grouping, ordering
- **Comment style**: Doc comments, inline comments, TODOs

Use surrounding files in the same package/module as the style reference.

If insufficient surrounding code exists to establish conventions, fall back to the language community's standard style guide (e.g., PEP 8 for Python, Effective Go) and note that conventions were inferred from community standards rather than codebase samples.

### 2. Language Idioms Check

Evaluate against language-specific best practices:

| Language | Common Idiom Violations |
|----------|------------------------|
| **Go** | Not using `errors.Is/As`, bare returns, not deferring cleanup, channel misuse, exported names without docs |
| **Python** | Not using context managers, mutable default args, bare `except`, not using comprehensions where appropriate |
| **TypeScript** | `any` type overuse, not using discriminated unions, callback hell vs async/await, non-null assertions |
| **Rust** | Unwrap in library code, not using `?` operator, Clone abuse, not leveraging ownership |
| **Java** | Raw types, checked exception abuse, mutable DTOs, not using try-with-resources |

### 3. Style Consistency

Compare the PR code against surrounding code for:

| Dimension | What to Check |
|-----------|--------------|
| **Naming** | Do new names follow existing conventions? |
| **Structure** | Same patterns for similar problems? (e.g., if existing code uses builder pattern, does new code too?) |
| **Formatting** | Indentation, line length, brace style matches |
| **Abstraction level** | Is the new code at the same abstraction level as peers? |
| **Documentation** | Same doc comment density and style? |

### 4. Design Pattern Assessment

Evaluate:
- **SOLID principles**: Single responsibility, open/closed, dependency inversion
- **Coupling**: Are new dependencies justified? Is the coupling loose?
- **Cohesion**: Do new types/functions have clear, singular purposes?
- **DRY**: Is logic duplicated that should be shared?
- **Interface segregation**: Are interfaces minimal and focused?
- **God objects**: Does any new type do too much?

### 5. Codebase Fit

Assess how the changes integrate:
- Do they follow existing module boundaries?
- Are new packages/modules in the right location?
- Do they use existing utilities or reinvent them?
- Is the dependency direction correct (no circular deps)?
- Does the API surface match existing patterns?

### 6. Severity Rubric

Use the following severity rubric:

- **Critical**: Will cause bugs, data loss, or security vulnerabilities in production
- **High**: Significant performance/correctness risk or major design flaw
- **Medium**: Code quality issue that increases maintenance burden
- **Low**: Stylistic or minor improvement suggestion

### 7. Output Format

```markdown
## Code Quality Summary

**Overall**: ✅ Good | ⚠️ Needs Attention | ❌ Significant Issues

### Issues

| # | Severity | Category | File | Lines | Issue | Suggested Fix |
|---|----------|----------|------|-------|-------|---------------|
| 1 | High | Idioms | file.go | L23 | Using string concat in loop | Use strings.Builder |
| 2 | Medium | Style | api.go | L45 | CamelCase breaks package convention | Rename to match_style |
| 3 | Medium | Design | svc.go | L12-80 | Handler does DB + business logic + response | Split into service layer |
| 4 | Low | Fit | util.go | L5 | Reimplements existing helper | Use pkg/util.StringTrim |

### Positive Observations
- <note what's done well to calibrate feedback>
```
