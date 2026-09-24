---
name: "pack-context"
description: "Select which candidate files fit an LLM context token budget with the ctxpack pack_context MCP tool. Use when deciding what to include in a context window under a token budget, or when the user mentions a context budget, token budget, or packing context."
license: "MIT"
metadata:
  author: "ikenyal"
  version: "1.0.0"
---

# Pack Context with ctxpack

## Overview

ctxpack turns "what should I put in the context window?" into a deterministic,
reproducible decision. Given a list of candidate items (each with an `id`, a
`priority`, and a `tokens` count) and a token `budget`, the `pack_context` MCP
tool returns the subset to include. This skill teaches you how to turn candidate
files into items, assign priorities, call the tool, and read its result
correctly.

The selection is **budget-monotone**: raising the budget never removes an item
that was already selected at a smaller budget. This predictability is the whole
point, and it drives the packing rule described below.

## Prerequisites Checklist

- [ ] The `ctxpack` MCP server is registered and running in the workspace at
      `.kiro/settings/mcp.json`, exposing the `pack_context` tool.
- [ ] You do **not** bundle an `mcp.json` with this power. See "MCP server
      requirement" below.
- [ ] You have a list of candidate files (or other chunks) and a token budget.

## MCP server requirement

This power intentionally ships **no `mcp.json`**. The ctxpack MCP server is
already registered in the workspace at `.kiro/settings/mcp.json`. Bundling the
server again in this power would start a **duplicate server** and register a
second `pack_context` tool. Rely on the workspace-registered server only.

If the `pack_context` tool is not available, fix the workspace registration in
`.kiro/settings/mcp.json` rather than adding an `mcp.json` here.

## The pack_context tool

**Input:**

| Field | Type | Description |
|-------|------|-------------|
| `items` | array | Candidate items. Each has `id` (string), `priority` (number), `tokens` (non-negative integer). |
| `budget` | integer | Maximum total tokens allowed (non-negative). |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| `selectedIds` | string[] | Ids of the selected items, in priority order. |
| `totalTokens` | integer | Sum of tokens across the selection. |
| `budget` | integer | The budget that was applied. |

## Step-by-Step Guide

### 1. Build one item per candidate file

Create exactly one item per candidate file. The item `id` should identify the
file (for example, its path). Estimate `tokens` from the file's character count:

```
tokens = ceil(characters / 4)
```

Roughly four characters per token is a deliberate, model-agnostic approximation;
exact tokenizer parity is a non-goal. Always round **up** so you never
underestimate a file's cost.

Example: a file with 4001 characters gives `ceil(4001 / 4) = ceil(1000.25) =
1001` tokens.

### 2. Assign a priority to each item

Higher `priority` means more important; higher-priority items are considered
first. Use a consistent scale. A workable default:

| Content type | Priority | Rationale |
|--------------|----------|-----------|
| Steering, requirements | high (e.g. 30) | Rules and goals shape everything else. |
| Design | middle (e.g. 20) | Important context, but subordinate to the rules. |
| Tasks, logs | low (e.g. 10) | Useful detail, first to be dropped under pressure. |

The exact numbers do not matter, only their order. Ties are broken by `id`
ascending, so the result never depends on input order.

### 3. Call pack_context

Pass the items and the budget:

```json
{
  "items": [
    { "id": "steering/product.md", "priority": 30, "tokens": 1200 },
    { "id": "requirements.md",      "priority": 30, "tokens": 800 },
    { "id": "design.md",            "priority": 20, "tokens": 2000 },
    { "id": "tasks.md",             "priority": 10, "tokens": 600 },
    { "id": "run.log",              "priority": 10, "tokens": 400 }
  ],
  "budget": 3000
}
```

### 4. Read the result

Use `selectedIds` to decide which files to actually load into context. Report
`totalTokens` against the `budget` so the user sees how much of the budget was
used.

## How packing decides (and why items get left out)

ctxpack sorts items by `priority` descending, then `id` ascending, walks the
sorted list, and **stops at the first item that does not fit**. It never skips an
over-budget item to squeeze in a smaller, lower-priority one later.

This means a lower-priority item that *would* fit on its own can still be left
out, because packing already stopped at a larger item ahead of it. That is
intentional: filling leftover budget with lower-priority items is a non-goal,
and stopping early is what keeps the result budget-monotone.

### Explaining why an item was excluded

When you tell the user why an item was left out, distinguish two cases based on
the budget remaining when packing reached that item:

- **Attribute the exclusion to the priority-prefix rule only when the item would
  have fit in the remaining budget** (its `tokens` are less than or equal to what
  was left). Here the item was dropped purely because packing stopped at an
  earlier over-budget item, not because of its own size.
- **If the item is larger than the remaining budget, say it simply did not fit.**
  The priority-prefix rule is not the reason; the item would have been excluded
  regardless.

### Worked example

Sorted items and a budget of 10:

| id | priority | tokens |
|----|----------|--------|
| A  | high     | 6      |
| B  | mid      | 5      |
| C  | low      | 4      |

- Take A (used 6, 4 left).
- B needs 5, only 4 left -> **does not fit, stop here.**
- Result: `{A}`. C is left out even though 4 tokens remain and C is exactly 4.

Raising the budget to 11 gives `{A, B}` (A then B, 0 left, stop). Because packing
only ever appends as the budget grows, C never "steals" a slot from B, and no
already-selected item disappears when the budget increases.

## Common Workflows

### Workflow: Pack a spec's files under a budget

**Goal:** Decide which spec artifacts fit a context budget.

1. List candidate files: steering, requirements, design, tasks, logs.
2. For each, compute `tokens = ceil(characters / 4)`.
3. Assign priorities: steering/requirements high, design middle, tasks/logs low.
4. Call `pack_context` with the items and the budget.
5. Load only the files in `selectedIds`; report `totalTokens` vs `budget`.

## Troubleshooting

### Error: "Duplicate id: <id>"
**Cause:** Two items share the same `id`.
**Solution:** Give every candidate a unique `id` (file paths work well), then
call again.

### The tool is not available
**Cause:** The ctxpack MCP server is not running or not registered.
**Solution:** Verify the `ctxpack` entry in the workspace
`.kiro/settings/mcp.json` and that the server is enabled. Do **not** add an
`mcp.json` to this power; that would start a duplicate server.

### A file I expected is missing from the result
**Cause:** Packing stopped at an earlier item that did not fit; everything after
it is excluded even if it would fit on its own.
**Solution:** This is expected priority-prefix behavior. Raise the budget, or
raise that file's priority so it is considered earlier.

## Best Practices

- Always round token estimates up (`ceil`), never down.
- Use stable, unique `id`s (file paths) so results are reproducible.
- Keep priority tiers simple and consistent; only the ordering matters.
- Do not expect leftover budget to be back-filled with smaller items; that is a
  deliberate non-goal.
- Never bundle an `mcp.json` with this power; use the workspace-registered
  ctxpack server.
