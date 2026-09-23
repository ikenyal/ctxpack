# Requirements Document

## Introduction

ctxpack-mcp exposes ctxpack's deterministic context-packing capability to LLM agents through a Model Context Protocol (MCP) server. The server runs locally over stdio and offers a single tool, `pack_context`, that accepts a list of items and a token budget and returns the selected item ids, the total tokens of the selection, and the budget that was applied.

The MCP server is an outer adapter layer. It performs no selection logic of its own: it validates and shapes input, delegates all selection to the existing pure core `pack()` function, and shapes the result back into an MCP tool response. This keeps selection deterministic, reproducible, and consistent with the CLI and Web surfaces, all of which share the same core.

## Glossary

- **MCP_Server**: The stdio Model Context Protocol server implemented in `src/mcp/`, built on the official TypeScript MCP SDK (`@modelcontextprotocol/sdk`). Registered as `ctxpack`.
- **pack_context**: The single MCP tool exposed by the MCP_Server. Accepts a list of items and a budget and returns the packing result.
- **Core**: The existing pure packing module in `src/core/`, exposing `pack(items, budget)`. The MCP_Server depends on Core; Core never depends on the MCP_Server.
- **Item**: A packable unit with fields `id` (string), `priority` (number), and `tokens` (number, non-negative integer).
- **Budget**: A non-negative integer giving the maximum total tokens the selection may use.
- **Selection**: The subset of Items chosen by Core under the Budget, returned in deterministic order (priority descending, then id ascending).
- **MCP_Tool_Error**: An error surfaced through the MCP tool-result error channel (a result flagged as an error), as opposed to an unhandled exception that would terminate the process.
- **MCP_Config**: The workspace MCP configuration file at `.kiro/settings/mcp.json` that registers the MCP_Server.

## Requirements

### Requirement 1: Run as a stdio MCP server

**User Story:** As an LLM agent, I want to connect to ctxpack over stdio using the MCP protocol, so that I can invoke context packing as a tool without any network dependency.

#### Acceptance Criteria

1. THE MCP_Server SHALL communicate using the Model Context Protocol over a stdio transport.
2. THE MCP_Server SHALL be implemented in `src/mcp/` using the official TypeScript MCP SDK (`@modelcontextprotocol/sdk`).
3. THE MCP_Server SHALL register exactly one tool named `pack_context`.
4. WHEN an MCP client completes the protocol handshake and requests the list of available tools, THE MCP_Server SHALL return exactly one tool, `pack_context`, with an input schema describing its `items` and `budget` inputs.
5. IF the stdio transport fails to initialize at startup, THEN THE MCP_Server SHALL terminate with a non-zero exit status and SHALL emit an error indication describing the failure.
6. IF an MCP client invokes a tool whose name is not `pack_context`, THEN THE MCP_Server SHALL return an MCP_Tool_Error indicating the tool is not recognized and SHALL continue running.

### Requirement 2: Pack context by delegating to Core

**User Story:** As an LLM agent, I want to call `pack_context` with items and a budget, so that I receive a deterministic selection of item ids that fit the budget.

#### Acceptance Criteria

1. WHEN `pack_context` is invoked with a valid list of Items and a valid Budget, THE MCP_Server SHALL delegate selection to the Core `pack()` function, passing the Items and Budget unchanged.
2. THE MCP_Server SHALL contain no selection logic and SHALL rely solely on Core to determine the Selection.
3. WHEN Core returns a Selection, THE MCP_Server SHALL return the ids of the selected Items, the total tokens of the Selection, and the Budget that was applied.
4. THE MCP_Server SHALL return the selected ids in the deterministic order produced by Core (priority descending, then id ascending).
5. WHEN Core returns an empty Selection, THE MCP_Server SHALL return an empty list of ids and a total tokens value of 0 together with the applied Budget.

### Requirement 3: Validate input and report errors as MCP tool errors

**User Story:** As an operator running the MCP server, I want invalid tool input to be reported as a tool error, so that the server keeps running and remains available to the agent.

#### Acceptance Criteria

1. IF the `items` input is not a list of objects, or any Item lacks a string `id`, a number `priority`, or a `tokens` value that is an integer greater than or equal to 0, THEN THE MCP_Server SHALL return an MCP_Tool_Error, flagged as an error result, whose content indicates which validation constraint the input violated.
2. IF the `budget` input is not an integer greater than or equal to 0, THEN THE MCP_Server SHALL return an MCP_Tool_Error, flagged as an error result, whose content indicates the invalid budget input.
3. IF the `items` input contains two or more Items sharing the same `id`, THEN THE MCP_Server SHALL catch the error raised by Core and return an MCP_Tool_Error, flagged as an error result, whose content indicates the duplicate id.
4. WHEN any invalid input is received, THE MCP_Server SHALL continue running and SHALL remain available to serve subsequent requests.
5. WHEN any invalid input is received, THE MCP_Server SHALL return no Selection.
6. WHEN a request supplies an empty `items` list or a `budget` equal to 0, THE MCP_Server SHALL treat the input as valid and delegate to Core rather than returning an MCP_Tool_Error.

### Requirement 4: Build and start the server

**User Story:** As an operator, I want a documented npm script to start the MCP server, so that I can launch it after building the project.

#### Acceptance Criteria

1. THE package configuration SHALL provide a single named npm script that starts the MCP_Server from the compiled output produced by `npm run build`.
2. WHEN the operator runs the start script after `npm run build` has completed successfully, THE MCP_Server SHALL begin listening for MCP requests over stdio within 5 seconds of process start.
3. WHILE the MCP_Server is listening over stdio, THE MCP_Server SHALL accept and respond to incoming MCP requests received on standard input.
4. IF the operator runs the start script when the compiled output produced by `npm run build` is absent, THEN THE MCP_Server SHALL not begin listening, SHALL terminate with a non-zero exit status, and SHALL emit an error indication reporting that the compiled output is missing.

### Requirement 5: Register the server in the workspace MCP config

**User Story:** As a Kiro user, I want the ctxpack MCP server registered in the workspace configuration with the packing tool auto-approved, so that agents can use it without repeated approval prompts.

#### Acceptance Criteria

1. THE MCP_Config SHALL exist at `.kiro/settings/mcp.json`.
2. THE MCP_Config SHALL register the MCP_Server under the key name `ctxpack`.
3. THE MCP_Config SHALL specify the command and arguments that start the compiled MCP_Server using the stdio transport.
4. THE MCP_Config SHALL include `pack_context` in the MCP_Server auto-approval list.
5. THE MCP_Config SHALL auto-approve exactly one MCP_Tool, `pack_context`, and SHALL NOT auto-approve any other tool.
