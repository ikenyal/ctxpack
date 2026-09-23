#!/usr/bin/env node
// ctxpack MCP server entry point.
// Thin process plumbing: build the server (from ./server), connect it to a
// stdio transport, and let a failed connect propagate. All tool logic lives in
// ./handler and delegates selection to `src/core/`. This module never imports
// from cli or web. The orchestration (server wiring) is in ./server, which
// keeps this file's only responsibility the process-level stdio plumbing.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './server.js';

// Re-export the adapter pieces so tests and other tooling can import them.
export { buildServer } from './server.js';
export { handlePackContext, type PackContextInput, type PackContextOutput } from './handler.js';

/**
 * Process entry: build the MCP server and connect it to a stdio transport so it
 * begins listening for MCP requests over standard input/output (Req 1.1, 4.2,
 * 4.3).
 *
 * The returned promise rejects if the transport fails to initialize; `main`
 * lets that rejection propagate so callers (and the guarded entry below) decide
 * how to react. The guarded entry catches it and exits non-zero (Req 1.5).
 */
export async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only run when invoked as a script, not when imported (e.g. by tests).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Failed to start ctxpack MCP server: ${message}\n`);
    process.exit(1);
  });
}
