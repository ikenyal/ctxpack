import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../../src/mcp/server.js';

/**
 * Integration test for the ctxpack MCP server (Req 1.1, 4.2, 4.3).
 *
 * Exercises the full request lifecycle end to end: an MCP client completes the
 * protocol handshake against the built server and performs a real
 * `pack_context` round trip. Selection is delegated to core, so the assertions
 * pin a known input to its deterministic result.
 *
 * Transport choice: the SDK's linked in-memory transport pair
 * (`InMemoryTransport.createLinkedPair()`) is used rather than a spawned
 * `node dist/mcp/index.js` process. The in-memory pair drives the same protocol
 * handshake, tools/list, and callTool paths as stdio without the flakiness and
 * latency of process spawning and without requiring a prior `npm run build`.
 *
 * Decision on the optional spawn-based stdio smoke test: it is intentionally
 * NOT included. It would require `dist/mcp/index.js` to exist (a build step
 * outside this test's control) and would spawn a child process, introducing
 * build-order coupling and timing/flakiness risk that the task explicitly warns
 * against. The in-memory handshake below covers Req 1.1/4.2/4.3 reliably; the
 * stdio wiring itself is verified separately via the process-entry test and the
 * config test. This keeps the suite fast and hermetic.
 */

/**
 * Connect an in-memory MCP client to a freshly built server, completing the
 * MCP protocol handshake. Mirrors the established pattern in server.test.ts.
 */
async function connectClient(): Promise<Client> {
  const server = buildServer();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

describe('MCP server integration (handshake + pack_context round trip)', () => {
  // Req 1.1, 4.2, 4.3: after the handshake, a single pack_context call over the
  // transport returns the deterministic selection for a known input.
  it('completes the handshake and packs a known input in one round trip', async () => {
    const client = await connectClient();

    // Known input. Sorted by core: priority desc, then id asc.
    //   c (priority 30, tokens 4) -> fits, used 4
    //   a (priority 20, tokens 3) -> fits, used 7
    //   b (priority 10, tokens 5) -> 7 + 5 = 12 > budget 8, stop (priority-prefix)
    // Expected selection: [c, a], total 7, budget 8.
    const result = await client.callTool({
      name: 'pack_context',
      arguments: {
        items: [
          { id: 'a', priority: 20, tokens: 3 },
          { id: 'b', priority: 10, tokens: 5 },
          { id: 'c', priority: 30, tokens: 4 },
        ],
        budget: 8,
      },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      selectedIds: ['c', 'a'],
      totalTokens: 7,
      budget: 8,
    });

    await client.close();
  });
});
