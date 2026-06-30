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

For each step, if the code under review contains no elements relevant to that step (e.g., a single pure function has no module-boundary implications for Step 5), omit that section from the output rather than generating a placeholder. Only include sections where at least one concrete observation exists.

If codebase files are not accessible and only a diff or snippet is provided, begin the review from Step 2 using the code provided, skip Steps 1, 1a, 3, and 5 in full, and prepend the output with: "⚠️ Codebase context unavailable — conventions and call sites could not be sampled. Findings reflect community standards only and the diff in isolation."

### 1. Establish Codebase Conventions

Examine the 3-5 files most structurally similar to the file under review (same package/module preferred, same abstraction layer second). If those files themselves show inconsistent conventions, note the inconsistency and defer to the language community standard.
- **Naming conventions**: camelCase vs snake_case, prefixes, suffixes
- **File organization**: Module structure, where things live
- **Error handling patterns**: How errors propagate, custom types
- **Abstraction style**: Interfaces vs concrete types, inheritance depth
- **Import organization**: Grouping, ordering
- **Comment style**: Doc comments, inline comments, TODOs

Use files that are direct peers of the file under review (same package or module directory). If multiple style patterns coexist in those files, flag the inconsistency in the review rather than choosing one arbitrarily.

If insufficient surrounding code exists to establish conventions, fall back to the language community's standard style guide (e.g., PEP 8 for Python, Effective Go) and note that conventions were inferred from community standards rather than codebase samples.

If no surrounding codebase is available, Steps 3 (Style Consistency) and 5 (Codebase Fit) cannot be evaluated against real conventions. For Step 3, apply community standards as the style baseline. For Step 5, skip module-boundary and utility-reuse checks and note in the output that codebase context was unavailable.

### 1a. Map Call Sites and Usage

Before evaluating any changed function, type, or interface, understand how it is used so the review reflects real context rather than the diff in isolation:

- **Find the callers**: search the codebase (e.g., `grep`/`Grep` for the symbol name) for every site that invokes a changed function, instantiates a changed type, or implements/satisfies a changed interface. Read the relevant call sites.
- **Understand how outputs are consumed**: trace what callers do with return values, errors, and side effects (e.g., is an error checked, is a returned slice mutated, is a nil result handled).
- **Understand how inputs arrive**: trace where arguments come from (validated upstream? user-controlled? already-locked?) so you can judge whether the changed code's assumptions hold.
- **For deletions or signature changes**: confirm every caller was updated; an orphaned or now-mismatched call site is a finding.

If a symbol is part of a public API (exported with no in-repo callers, or a library boundary), note that call sites may live outside this repository and evaluate against the documented contract instead. If call sites cannot be located, state this and mark affected findings as based on the diff alone.

### 2. Language Idioms Check

Evaluate against language-specific best practices:

| Language | Common Idiom Violations |
|----------|------------------------|
| **Go** | Not using `errors.Is/As`, bare returns, not deferring cleanup, channel misuse, exported names without docs |
| **Python** | Not using context managers, mutable default args, bare `except`, using explicit for-loops to build a list/dict/set where a comprehension would reduce it to a single expression without sacrificing readability (i.e., no nested conditionals inside the comprehension) |
| **TypeScript** | `any` type overuse, not using discriminated unions, callback hell vs async/await, non-null assertions |
| **Rust** | Unwrap in library code, not using `?` operator, Clone abuse, not leveraging ownership |
| **Java** | Raw types, checked exception abuse, mutable DTOs, not using try-with-resources |

If the language is not listed above, apply the language's official style guide and widely-adopted linter rules (e.g., StyleCop for C#, ktlint for Kotlin) as the idiom reference, and note in the output which reference was used.

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
- **Calling context**: Before suggesting a change to a function's internal behavior
  (error strategy, validation, caching, defensive checks), examine how the function
  is called. If the caller already addresses the concern, the suggestion adds
  complexity without value.

### 5. Codebase Fit

Assess how the changes integrate:
- Do they follow existing module boundaries?
- Are new packages/modules in the right location?
- Do they use existing utilities or reinvent them?
- Is the dependency direction correct (no circular deps)?
- Does the API surface match existing patterns?

### 6. Severity Rubric

Use the following severity rubric:

- **Critical**: Severe design flaw that will directly cause incorrect behavior or a broken abstraction (note: security vulnerabilities and data-loss bugs are out of scope for this review — flag them with a note to consult a security review, but do not assign Critical for them)
- **High**: Significant correctness risk or major design flaw
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

Suggested Fix should be a concise action phrase (verb + target), e.g. "Replace with strings.Builder" or "Extract DB call into repository layer". Do not include inline code snippets in the table cell; reserve those for an optional expanded section below the table if the fix is non-obvious.

### Positive Observations
- <note what's done well to calibrate feedback>
```
