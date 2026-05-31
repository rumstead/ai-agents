---
name: performance-review
description: "Identify hidden performance bottlenecks, scalability risks, and concurrency issues in code changes. Use when: reviewing for performance, checking scalability, auditing concurrency safety, evaluating resource usage."
user-invocable: false
---

# Performance & Scalability Review

## When to Use

- Identify hidden performance bottlenecks in code changes
- Assess scalability risks (will this work at 10x, 100x load?)
- Audit concurrency safety (race conditions, deadlocks)
- Evaluate resource usage (memory, connections, file handles)

## Procedure

### 1. Identify Hot Paths

Determine which changed code runs:
- **Per-request**: API handlers, middleware, request processing
- **Per-item**: Loop bodies, batch processing, stream handlers
- **Continuously**: Background workers, watchers, polling loops
- **At startup**: Initialization, config loading (less critical)

Focus review effort proportional to execution frequency.

### 2. Algorithmic Complexity

For each hot path, assess:

| Pattern | Risk | What to Look For |
|---------|------|-----------------|
| **Nested loops** | O(n²) or worse | Loop over collection inside another loop over related collection |
| **Unbounded queries** | Memory explosion | SELECT without LIMIT, loading all records into memory |
| **Linear search** | O(n) where O(1) possible | Scanning arrays when a map/set lookup would work |
| **String building** | O(n²) allocations | Concatenation in loops vs builder/buffer |
| **Recursive calls** | Stack overflow | No depth limit, no tail-call optimization |

### 3. I/O and Network

| Pattern | Risk | What to Look For |
|---------|------|-----------------|
| **N+1 queries** | Latency multiplication | Loading parent then looping to load children |
| **Sequential I/O** | Wasted parallelism | Independent requests made sequentially |
| **Missing batching** | Connection overhead | Individual inserts/updates instead of bulk |
| **No timeouts** | Resource exhaustion | HTTP/DB calls without timeout/context deadline |
| **Large payloads** | Memory pressure | Deserializing entire response when only subset needed |
| **Missing pagination** | Unbounded responses | API returns all results with no limit |

### 4. Concurrency Safety

| Pattern | Risk | What to Look For |
|---------|------|-----------------|
| **Shared mutable state** | Race condition | Maps, slices, structs accessed from multiple goroutines/threads |
| **Lock ordering** | Deadlock | Multiple locks acquired in different orders |
| **Lock granularity** | Contention | Single lock protecting unrelated data |
| **Channel/queue sizing** | Backpressure | Unbuffered channels causing goroutine leaks |
| **Context propagation** | Zombie operations | Missing cancellation propagation |

### 5. Resource Management

| Pattern | Risk | What to Look For |
|---------|------|-----------------|
| **Connection pools** | Exhaustion | Not returning connections, no max pool size |
| **File handles** | Leak | Opening without defer/finally close |
| **Memory allocation** | GC pressure | Allocating in hot loops, large temporary buffers |
| **Caching** | Unbounded growth | Cache without TTL or max size |
| **Goroutine/thread spawning** | Leak | No lifecycle management, no WaitGroup/join |

### 6. Scalability Assessment

For each concern, evaluate:
- **Current scale**: Does this matter at today's traffic?
- **10x scale**: Will this become a problem with 10x growth?
- **Failure mode**: What happens when the limit is hit? (graceful degradation vs crash)

### 7. Output Format

```markdown
## Performance & Scalability Summary

**Risk Level**: ✅ Low Risk | ⚠️ Moderate Risk | ❌ High Risk

### Issues

| # | Severity | Category | File | Lines | Issue | Impact | Suggested Fix |
|---|----------|----------|------|-------|-------|--------|---------------|
| 1 | Critical | N+1 Query | repo.go | L34-45 | Loads tags per-item in loop | O(n) DB calls, ~100ms/item | Use JOIN or batch query |
| 2 | High | Concurrency | cache.go | L12 | Map read/write without lock | Race condition under load | Use sync.RWMutex or sync.Map |
| 3 | Medium | Memory | handler.go | L67 | Buffers full response body | OOM risk on large payloads | Stream response with io.Copy |
| 4 | Low | Complexity | search.go | L89 | Linear scan of sorted data | Slow above 10k items | Use binary search |

### Scalability Notes
- <observations about how this will behave at higher scale>
- <any positive patterns observed (good use of pooling, pagination, etc.)>
```
