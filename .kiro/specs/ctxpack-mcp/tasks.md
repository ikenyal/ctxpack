# Implementation Plan: ctxpack-mcp

## Overview

Build a stdio MCP server as a new adapter layer at `src/mcp/`, exposing a single
`pack_context` tool that delegates all selection to the pure `core.pack()`. The
plan proceeds inward-out and bottom-up: first add the runtime dependencies, then
the leaf validation module, then the handler that delegates to core, then the
server wiring, then the process entry, then build/config artifacts, and finally
the integration and smoke tests. Dependencies point strictly `mcp -> core`; the
core is not touched. Property tests (fast-check, minimum 100 iterations each)
cover the three delegation-layer correctness properties from the design.

## Tasks

- [ ] 1. Add MCP runtime dependencies and start script
  - [ ] 1.1 Add SDK/zod dependencies and the start script to `package.json`
    - Add `@modelcontextprotocol/sdk` (pinned exact version, e.g. `1.30.1`) and
      its peer `zod` (pinned exact version) to `dependencies` in `package.json`
      (the repo currently has none), matching the existing pinned-dependency
      convention (`fast-check`, `@types/node`).
    - Add exactly one start script `"start:mcp": "node dist/mcp/index.js"` to the
      `scripts` block, pointing at the compiled entry produced by `npm run build`.
    - Run `npm install` so the lockfile records the pinned versions.
    - _Requirements: 4.1, 5.3_

- [ ] 2. Implement MCP input validation (`src/mcp/validate.ts`)
  - [ ] 2.1 Implement `McpInputError`, `validateItems`, and `validateBudget`
    - Create `src/mcp/validate.ts`. Export `class McpInputError extends Error`
      (with `name = 'McpInputError'`).
    - Implement `validateItems(value: unknown): Item[]` mirroring the CLI rules:
      value must be an array; each item must have a string `id`, a finite number
      `priority`, and a `tokens` value that is an integer `>= 0`. Throw
      `McpInputError` describing the first violated constraint.
    - Implement `validateBudget(value: unknown): number` requiring an integer
      `>= 0` (use `Number.isInteger` and a safe-integer upper bound), throwing
      `McpInputError` describing the invalid budget. Import `Item` from
      `../core/index.js`; do not import from `cli` or `web`.
    - _Requirements: 3.1, 3.2_

  - [ ] 2.2 Write unit tests for validation (`tests/mcp/validate.test.ts`)
    - Accept/reject examples mirroring the CLI's `load.test.ts`: non-integer
      tokens, negative tokens, non-string id, non-finite (NaN) priority,
      non-array items, negative budget, fractional budget, and valid samples.
    - _Requirements: 3.1, 3.2_

- [ ] 3. Implement the pack_context handler (`src/mcp/handler.ts`)
  - [ ] 3.1 Implement `handlePackContext` delegating to core
    - Create `src/mcp/handler.ts`. Define `PackContextInput`
      (`{ items: unknown; budget: unknown }`) and `PackContextOutput`
      (`{ selectedIds: string[]; totalTokens: number; budget: number }`).
    - Implement `handlePackContext(input): CallToolResult` (type from the SDK):
      call `validateItems(input.items)`, then `validateBudget(input.budget)`,
      then `pack(items, budget)` from `../core/index.js`. On success return
      `structuredContent` (`selectedIds` = `result.selected.map(i => i.id)` in
      core's order, `totalTokens`, applied `budget`) plus a human-readable
      `content: [{ type: 'text', text }]` summary.
    - Wrap validation and the `pack` call in a single `try/catch`; map any error
      to `{ isError: true, content: [{ type: 'text', text: message }] }` using
      `err instanceof Error ? err.message : String(err)`. Never throw out of the
      handler. Error results must carry no `structuredContent`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 3.2 Write unit/example tests for the handler (`tests/mcp/handler.test.ts`)
    - A concrete success case with a known selection; the empty-items case
      returning `[]`/`0` (Req 2.5); the `budget === 0` case (Req 3.6); one
      explicit malformed-item message check; one explicit invalid-budget message
      check.
    - _Requirements: 2.3, 2.5, 3.1, 3.2, 3.6_

  - [ ] 3.3 Write property test: Delegation fidelity (`tests/mcp/handler.property.test.ts`)
    - **Property 1: Delegation fidelity**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.6**
    - Tag comment: `// Feature: ctxpack-mcp, Property 1: For any array of valid items and any non-negative integer budget, the pack_context result equals core.pack's selection (ids in order), totalTokens, and echoed budget.`
    - fast-check, minimum 100 iterations. Generator: `uniqueArray` keyed on `id`,
      `priority` an arbitrary finite number (incl. negatives/ties), `tokens` a
      non-negative integer, `budget` a non-negative integer spanning below, at,
      and above the token sum; include the empty-items and `budget === 0` cases.
      Assert the handler result equals `core.pack(items, budget)` directly.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.6_

  - [ ] 3.4 Write property test: Error safety / no-crash (`tests/mcp/handler.property.test.ts`)
    - **Property 2: Error safety and no-crash on invalid input**
    - **Validates: Requirements 3.1, 3.2, 3.4, 3.5**
    - Tag comment: `// Feature: ctxpack-mcp, Property 2: For any invalid input, the handler returns isError:true with a text message, never throws, carries no selection, and stays responsive to a subsequent valid request.`
    - fast-check, minimum 100 iterations. Generator: non-array items, items
      mistyping `id`/`priority`/`tokens` (numeric id, non-integer/negative
      tokens, NaN priority), and invalid budgets (negative, fractional, NaN,
      non-number). Assert no throw, `isError === true`, non-empty text, no
      selection payload, and that a following known-valid input succeeds.
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [ ] 3.5 Write property test: Duplicate ids surface as tool error (`tests/mcp/handler.property.test.ts`)
    - **Property 3: Duplicate ids surface as a tool error naming the id**
    - **Validates: Requirements 3.3**
    - Tag comment: `// Feature: ctxpack-mcp, Property 3: For any items array with a duplicated id and a valid budget, the handler catches core's error, returns isError:true whose message includes the duplicated id, and does not throw.`
    - fast-check, minimum 100 iterations. Generator: a valid items array of
      length `>= 1`, then clone one element's `id` onto another to force a
      duplicate; pair with a valid budget. Assert no throw, `isError === true`,
      and the message contains the duplicated id.
    - _Requirements: 3.3_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Build the MCP server and register the tool (`src/mcp/server.ts`)
  - [ ] 5.1 Implement `buildServer` registering the single pack_context tool
    - Create `src/mcp/server.ts` exporting `buildServer(): McpServer`. Construct
      an `McpServer` and call `server.registerTool('pack_context', config, handler)`.
    - `config` carries a `description`, a zod `inputSchema`
      (`items: z.array(z.object({ id: z.string(), priority: z.number(), tokens: z.number().int().nonnegative() }))`,
      `budget: z.number().int().nonnegative()`), and an `outputSchema`
      (`selectedIds: z.array(z.string())`, `totalTokens`, `budget`).
    - The handler is `async (args) => handlePackContext(args)` from `./handler.js`.
      Register no other tool. No process globals here.
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ] 5.2 Write tool-registration test (`tests/mcp/server.test.ts`)
    - Connect an in-memory client to `buildServer()`, list tools, assert exactly
      one tool named `pack_context` whose input schema advertises `items` and
      `budget`. Call an unknown tool name and assert an `isError` result, then
      assert a following valid `pack_context` call still succeeds.
    - _Requirements: 1.3, 1.4, 1.6_

- [ ] 6. Implement the process entry (`src/mcp/index.ts`)
  - [ ] 6.1 Implement `main` connecting the stdio transport
    - Create `src/mcp/index.ts` exporting `async function main(): Promise<void>`
      that builds the server via `buildServer()`, creates a
      `StdioServerTransport`, and `await server.connect(transport)`.
    - Guard the process-start call with the CLI's
      `import.meta.url === \`file://${process.argv[1]}\`` pattern so importing
      the module in tests does not start the server. In the guarded entry, catch
      a rejected `connect`, write a description to `stderr`, and call
      `process.exit(1)`.
    - _Requirements: 1.1, 1.5, 4.2, 4.3_

  - [ ] 6.2 Write startup-failure test (`tests/mcp/index.test.ts`)
    - Inject a transport whose init rejects into `main` and assert the returned
      promise rejects (the entry maps this to a non-zero exit).
    - _Requirements: 1.5_

- [ ] 7. Register the workspace MCP config (`.kiro/settings/mcp.json`)
  - [ ] 7.1 Create the MCP config file
    - Create `.kiro/settings/mcp.json` with `mcpServers.ctxpack` set to
      `command: "node"`, `args: ["dist/mcp/index.js"]`, `disabled: false`, and
      `autoApprove: ["pack_context"]` (exactly one tool, no others).
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 7.2 Write config test (`tests/mcp/config.test.ts`)
    - Read `.kiro/settings/mcp.json`; assert it parses, registers `ctxpack` with
      `command: "node"`, args referencing `dist/mcp/index.js`, `disabled: false`,
      and `autoApprove` deep-equals `["pack_context"]`. Read `package.json`;
      assert the single `start:mcp` script points at `dist/mcp/index.js`.
    - _Requirements: 4.1, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 8. Integration and smoke tests
  - [ ] 8.1 Write handshake / stdio integration test (`tests/mcp/integration.test.ts`)
    - Connect an in-memory client to the built server, complete the handshake,
      and perform one `pack_context` round trip asserting a success result.
      Optionally add a spawn-based smoke test that starts
      `node dist/mcp/index.js` and performs one round trip.
    - _Requirements: 1.1, 4.2, 4.3_

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All test sub-tasks are required; there are no optional tasks in this plan.
- Each task references specific requirements (and property tests reference their
  design property) for traceability.
- Property tests use fast-check with a minimum of 100 iterations each and carry a
  tag comment in the form `Feature: ctxpack-mcp, Property {n}: {text}`.
- The MCP layer imports only from `core`; it never imports from `cli` or `web`,
  and the core is not modified by this plan.
- Req 4.4 (missing compiled output exits non-zero) is satisfied by Node's own
  module resolution and is documented as a manual check in the design's Testing
  Strategy, so it has no separate coding task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "7.1"] },
    { "id": 1, "tasks": ["2.2", "3.1", "7.2"] },
    { "id": 2, "tasks": ["3.2", "3.3", "5.1"] },
    { "id": 3, "tasks": ["3.4", "5.2", "6.1"] },
    { "id": 4, "tasks": ["3.5", "6.2", "8.1"] }
  ]
}
```
