# ctxpack

[![CI](https://github.com/ikenyal/ctxpack/actions/workflows/ci.yml/badge.svg)](https://github.com/ikenyal/ctxpack/actions/workflows/ci.yml)

A deterministic context packer for LLM agents.



https://github.com/user-attachments/assets/92164e01-4900-41c5-9e3d-b172938489fb



Given a list of items — each with an `id`, a `priority`, and a `tokens` count —
and a token budget, ctxpack selects which items to include in the context. Agents
have limited context windows, so deciding what to include should be predictable,
not ad hoc. ctxpack makes that selection deterministic and reproducible.

Everything runs locally and self-contained: no backend, no database, no network
calls.

## Surfaces

ctxpack exposes the same core selection logic through several surfaces:

- **Core library** (`src/core/`): the pure packing function. All other surfaces
  delegate selection to it.
- **CLI** (`src/cli/`): `ctxpack pack items.json --budget 8000`.
- **Web UI** (`src/web/`): a single-page app with a budget slider.
- **MCP server** (`src/mcp/`): exposes a `pack_context` tool over MCP; run with
  `npm run start:mcp`.
- **Kiro power** (`powers/ctxpack/`): packages the packing workflow as an
  installable Kiro power.
- **Custom agent** (`.kiro/agents/context-planner.md`): a read-only planning agent
  that uses the `pack_context` MCP tool.

## Packing semantics (priority-prefix)

ctxpack uses **priority-prefix packing**:

1. Sort items deterministically — by `priority` descending, then by `id`
   ascending as a tie-breaker. This makes the result independent of input order.
2. Walk the sorted list and stop at the **first** item that does not fit. Never
   skip an over-budget item to fit a smaller one later.

Stopping at the first item that does not fit wastes budget on purpose, in exchange
for a key guarantee: the packer is **budget-monotone**. Increasing the budget never
removes an item that was selected at a smaller budget — it only ever appends items.

The naive "skip anything that does not fit and keep going" approach breaks this
guarantee (an item can disappear when the budget grows), so ctxpack does not use it.

Duplicate `id`s are rejected: `pack` throws an error if two items share the same
`id`, because duplicates would break the deterministic total order.

## Token counter

Items carry a precomputed `tokens` count, so the core packing function does not
count tokens itself. When you need to turn raw text into a token count, ctxpack
provides a pluggable `TokenCounter` interface and a default implementation,
`approxTokenCounter`.

> **The default token counter is an approximation.** It estimates roughly four
> characters per token via `Math.ceil(text.length / 4)`. It does **not** match any
> real model tokenizer (GPT, Claude, or any specific model). Use it for a rough,
> dependency-free estimate; supply your own `TokenCounter` when accuracy matters.

## Requirements

- Node.js 20 or newer.

## Install

```sh
npm install
```

## Running the tests

```sh
npm test
```

## Web UI

The Web UI is a small single-page app with a budget slider: it renders all items
and highlights the selected set as you move the slider, delegating all selection
to the core.

Start the dev server (started manually):

```sh
npm run dev
```

## Build

```sh
npm run build # type-check, emit the compiled output, and build the Web UI bundle
```

## CLI usage

After building (`npm run build`), run the CLI with Node:

```sh
node dist/cli/index.js pack items.json --budget 8000
```

To make the `ctxpack` command available globally, run `npm link` — then you can
invoke it directly:

```sh
ctxpack pack items.json --budget 8000
```

The CLI reads a JSON file of items, delegates selection to the core, and prints
the selected item `id`s and the total tokens of the selected set.

### Example `items.json`

Each item has an `id` (string), a `priority` (number, higher is more important),
and a `tokens` count (non-negative integer):

```json
[
  { "id": "system-prompt", "priority": 100, "tokens": 1200 },
  { "id": "recent-messages", "priority": 90, "tokens": 3000 },
  { "id": "retrieved-doc-1", "priority": 50, "tokens": 2500 },
  { "id": "retrieved-doc-2", "priority": 50, "tokens": 4000 },
  { "id": "scratch-notes", "priority": 10, "tokens": 800 }
]
```

### Example output

Running with a budget of `8000`:

```sh
node dist/cli/index.js pack items.json --budget 8000
```

```
Selected (3): system-prompt, recent-messages, retrieved-doc-1
Total tokens: 6700
```

Items are sorted by `priority` descending (ties broken by `id` ascending), then
selected as a prefix. Here `system-prompt` (1200), `recent-messages` (3000), and
`retrieved-doc-1` (2500) fit within 8000 for a running total of 6700. The next item,
`retrieved-doc-2` (4000), does not fit (6700 + 4000 > 8000), so packing stops there —
`scratch-notes` is not considered even though it would fit, because priority-prefix
packing never skips ahead.

## Project layout

```
ctxpack/
├── src/
│   ├── core/   # Pure packing logic + token counter (no side effects, no I/O)
│   ├── cli/    # CLI adapter: arg parsing, file reading -> core
│   └── web/    # Vite single-page UI: budget slider -> core
└── tests/      # Vitest unit + property-based tests, mirroring src/
```

Dependencies point inward: `cli` and `web` depend on `core`; the core never imports
from the outer layers.

## How this project uses Kiro

| Lesson | What we did | Where to look |
|--------|-------------|---------------|
| Spec-driven development | Built the project from two specs | `.kiro/specs/ctxpack/` and `.kiro/specs/ctxpack-mcp/` |
| Steering | Captured project rules as steering; `packing-semantics.md` enforces priority-prefix packing | `.kiro/steering/` |
| Hooks | Two `PostFileSave` hooks and one `PostTaskExec` hook, with a run log | `.kiro/hooks/`, `.kiro/hook-runs.log` |
| Property-based testing | Documented correctness properties in both `design.md` files and tested them | `tests/core/pack.property.test.ts`, `tests/mcp/handler.property.test.ts` |
| Powers | Packaged the workflow as a Kiro power, created with the Build a Power power from the Kiro powers registry | `powers/ctxpack/` |
| MCP | Built an MCP server exposing `pack_context`, registered in the workspace | `src/mcp/`, `.kiro/settings/mcp.json` |
| Custom agents | A read-only `context-planner` agent with `pack_context` pre-approved | `.kiro/agents/context-planner.md` |
| Bonus — Kiro Web cloud session | PR #1 opened by `kiro-agent`, which added the CI workflow | `.github/workflows/ci.yml` |
| Bonus — packaged power | Install with "Import power from GitHub" | https://github.com/ikenyal/ctxpack/tree/main/powers/ctxpack |

## Using ctxpack from Kiro

1. Run `npm run build` first so the compiled MCP server exists at `dist/mcp/index.js`.
2. The workspace registers the MCP server via `.kiro/settings/mcp.json`.
3. If Kiro shows `spawn node ENOENT`, launch Kiro from a terminal so it inherits your
   `PATH` (and can find `node`).
4. Switch to `context-planner` in the agent picker.

The `context-planner` agent has no shell, so it estimates file sizes by reading the
files (`tokens = ceil(characters / 4)`) rather than measuring them with a command.

## License

Released under the [MIT License](LICENSE).
