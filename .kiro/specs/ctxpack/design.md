# Design

## Overview

ctxpack is a local, self-contained TypeScript project with a clean layered
architecture. All packing logic lives in a pure core; the CLI and Web UI are thin
adapters that delegate selection to the core.

Dependencies always point inward:

```
cli ─┐
     ├─> core   (core never imports cli or web)
web ─┘
```

## Architecture

```
ctxpack/
├── src/
│   ├── core/   # Pure packing logic + token counter (no I/O)
│   ├── cli/    # Arg parsing, file reading -> core
│   └── web/    # Vite SPA: budget slider -> core
├── tests/      # Vitest unit + property-based tests
└── .kiro/
```

### Tech stack

- TypeScript in strict mode, Node 20+.
- Vite for the Web UI, Vitest for tests, ESLint for linting.
- No backend, no database, no network calls.

## Core module

### Data model

```ts
export interface Item {
  id: string;        // unique identifier
  priority: number;  // higher = more important
  tokens: number;    // non-negative integer token count
}

export interface PackResult {
  selected: Item[];      // deterministically ordered
  totalTokens: number;   // sum of selected tokens
}
```

### Sorting

A single deterministic comparator is the foundation of both correctness and
order-independence:

```ts
function compareItems(a: Item, b: Item): number {
  if (a.priority !== b.priority) return b.priority - a.priority; // priority desc
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;                 // id asc
}
```

Unique `id`s are required so the comparator induces a total order — this is what
makes the result independent of input order. Uniqueness is not assumed; it is
enforced by `pack` (see below), which throws on duplicate `id`s. Without that check,
two items sharing the same `id` and `priority` but differing in `tokens` would make
`compareItems` return `0`, leaving their relative order dependent on the input order
and breaking order independence.

### Packing algorithm (priority-prefix)

```ts
export function pack(items: Item[], budget: number): PackResult {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      throw new Error(`Duplicate id: ${item.id}`);
    }
    ids.add(item.id);
  }
  const sorted = [...items].sort(compareItems);
  const selected: Item[] = [];
  let used = 0;
  for (const item of sorted) {
    if (used + item.tokens > budget) break; // stop at first item that does not fit
    selected.push(item);
    used += item.tokens;
  }
  return { selected, totalTokens: used };
}
```

The `break` (never `continue`) is deliberate: skip-and-continue would violate budget
monotonicity, as shown in `packing-semantics.md`. `pack` is a pure function — no I/O,
no mutation of the input array.

### Token counter (pluggable)

```ts
export interface TokenCounter {
  count(text: string): number;
}

/**
 * Default approximation. NOT a real tokenizer: it does not match GPT, Claude,
 * or any specific model. It estimates ~4 characters per token.
 */
export const approxTokenCounter: TokenCounter = {
  count: (text) => Math.ceil(text.length / 4),
};
```

Callers that hold raw text derive `tokens` via a `TokenCounter` before calling
`pack`. `pack` itself operates on precomputed `tokens`, keeping it independent of any
counter. A custom counter can be supplied wherever text-to-tokens conversion happens.

## CLI module

- Command: `ctxpack pack <file> --budget <n>`.
- Reads and parses the JSON file into `Item[]`, validates shape and the `--budget`
  argument, then calls `core.pack`.
- Prints the selected `id`s and total tokens to stdout.
- On any error (missing/unreadable file, invalid JSON, bad item shape, invalid
  budget) prints a descriptive message to stderr and exits non-zero.
- Contains no selection logic.

## Web UI module

- Vite single-page app. Loads a list of items and renders all of them with `id`,
  `priority`, and `tokens`.
- A budget slider drives selection: on each change, the UI calls `core.pack` and
  highlights the selected items, and shows total tokens vs. budget.
- Holds no packing logic; it is a pure view over the core.

## Correctness properties

Each property below is a claim the implementation must satisfy and is validated by
property-based tests (see tasks). Each traces back to a requirement.

### Property 1 — Budget

The total tokens of the selected items never exceed the budget.

```
sum(item.tokens for item in result.selected) <= budget
```

**Traces to:** Requirement 1 (priority-prefix packing within a token budget),
acceptance criteria 1.2 and 1.3.

### Property 2 — No priority inversion

The lowest priority among selected items is greater than or equal to the highest
priority among unselected items.

```
min(priority of selected) >= max(priority of unselected)
```

(Vacuously true when either set is empty.) This follows from packing a prefix of the
priority-descending sorted order.

**Traces to:** Requirement 1 (priority-prefix packing), acceptance criteria 1.1 and
1.3.

### Property 3 — Budget monotonicity

For budgets `b1 <= b2`, the items selected at `b1` are a subset of the items selected
at `b2`.

```
b1 <= b2  =>  selected(items, b1) ⊆ selected(items, b2)
```

Priority-prefix packing guarantees this: growing the budget only ever extends the
prefix, never drops an item. This is the reason skip-and-continue is forbidden.

**Traces to:** Requirement 1 (priority-prefix, no skip-and-continue), acceptance
criterion 1.3.

### Property 4 — Order independence

Shuffling the input does not change the result.

```
pack(shuffle(items), budget) == pack(items, budget)
```

The deterministic total-order comparator makes the sorted list — and therefore the
result — invariant under input permutation.

**Traces to:** Requirement 2 (deterministic output regardless of input order),
acceptance criteria 2.1, 2.2, 2.3, and 2.4 (duplicate `id`s are rejected so the
comparator stays a total order).

## Error handling

- **Core**: total function over well-typed input with unique `id`s; treats a `0`
  budget as selecting only zero-token prefix items. Throws on duplicate `id`s, since
  duplicates would break order independence. Otherwise no throwing on valid `Item[]`.
- **CLI**: validates file existence, JSON parseability, item shape, and budget;
  reports descriptive errors to stderr and exits non-zero.
- **Web UI**: constrains the slider to `[0, sum(all tokens)]` so the budget stays in
  a meaningful range.

## Testing strategy

- **Unit tests (core)**: sorting, prefix packing, tie-breaking, empty/zero-budget
  edge cases.
- **Property-based tests (core)**: the four correctness properties above, using
  randomized `Item[]` and budgets. Placed immediately after the core packing task.
- **CLI tests**: argument parsing, JSON reading, output formatting, error/exit-code
  paths.
- **Web UI tests**: rendering all items and updating highlights as the budget
  changes (logic delegated to core).
- Run with `vitest --run`.
