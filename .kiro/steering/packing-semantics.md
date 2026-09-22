# Packing Semantics

The packer must be **budget-monotone**: increasing the budget must never remove an item that was selected at a smaller budget.

## Sorting

Sort items deterministically so the result does not depend on input order:

1. By `priority` descending (higher priority first).
2. Then by `id` ascending as a tie-breaker.

## Priority-prefix packing

Walk the sorted list and stop at the **first** item that does not fit. Never skip an over-budget item to fit a smaller one later. This wastes budget on purpose, in exchange for predictable, budget-monotone behavior.

```ts
// ✅ priority-prefix: stop at the first item that does not fit
for (const item of sorted) {
  if (used + item.tokens > budget) break;
  selected.push(item);
  used += item.tokens;
}

// ❌ skip-and-continue: violates budget monotonicity
for (const item of sorted) {
  if (used + item.tokens > budget) continue;
  selected.push(item);
  used += item.tokens;
}
```

## Why skip-and-continue is forbidden

The naive greedy approach ("sort by priority, skip any item that does not fit, keep going") breaks budget monotonicity.

| item | priority | tokens |
|------|----------|--------|
| A    | high     | 6      |
| B    | mid      | 5      |
| C    | low      | 4      |

- budget 10: take A (4 left), skip B, take C -> {A, C}
- budget 11: take A (5 left), take B (0 left), skip C -> {A, B}

C disappears when the budget grows. Priority-prefix packing avoids this: at budget 10 it stops after A (B does not fit), and growing the budget only ever appends items, never removes them.
