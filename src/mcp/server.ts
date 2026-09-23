// ctxpack MCP server wiring.
// Builds an McpServer and registers the single `pack_context` tool. This module
// holds no selection logic and no process globals (no stdio, no process.exit):
// it only wires the tool's schema to the handler, which delegates to core.pack.
// Depends only on the SDK, zod, and this layer's handler; never on cli or web.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { handlePackContext } from './handler.js';

/**
 * Build the MCP server and register the single `pack_context` tool.
 *
 * The tool's zod `inputSchema` is the SDK's first-line gate (types and basic
 * shape); the handler's own validation is the authoritative, deterministic gate
 * that produces the exact error messages. Exactly one tool is registered, so an
 * MCP client's `tools/list` returns only `pack_context` (Req 1.3, 1.4). Unknown
 * tool names are handled by the SDK, which keeps the server running (Req 1.6).
 *
 * No transport is created and no process globals are touched here; the process
 * entry (`index.ts`) owns stdio and exit handling.
 *
 * @returns A configured {@link McpServer} ready to connect to a transport.
 */
export function buildServer(): McpServer {
  const server = new McpServer({
    name: 'ctxpack',
    version: '0.1.0',
  });

  server.registerTool(
    'pack_context',
    {
      description: 'Deterministically select items that fit a token budget.',
      inputSchema: {
        items: z
          .array(
            z.object({
              id: z.string(),
              priority: z.number(),
              tokens: z.number().int().nonnegative(),
            }),
          )
          .describe('Candidate items to pack.'),
        budget: z
          .number()
          .int()
          .nonnegative()
          .describe('Maximum total tokens (non-negative integer).'),
      },
      outputSchema: {
        selectedIds: z.array(z.string()),
        totalTokens: z.number().int().nonnegative(),
        budget: z.number().int().nonnegative(),
      },
    },
    async (args) => handlePackContext(args),
  );

  return server;
}
