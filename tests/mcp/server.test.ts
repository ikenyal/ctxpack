import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../../src/mcp/server.js';

/**
 * Connect an in-memory MCP client to a freshly built server.
 *
 * Uses the SDK's linked in-memory transport pair so the tool registration and
 * error behavior can be exercised without spawning a process or touching stdio.
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

describe('buildServer tool registration', () => {
  // Requirement 1.3, 1.4: exactly one tool named pack_context whose input
  // schema advertises the items and budget inputs.
  it('registers exactly one pack_context tool advertising items and budget', async () => {
    const client = await connectClient();

    const { tools } = await client.listTools();

    expect(tools).toHaveLength(1);
    const tool = tools[0];
    if (tool === undefined) {
      throw new Error('expected a registered tool');
    }
    expect(tool.name).toBe('pack_context');

    const properties = tool.inputSchema.properties ?? {};
    expect(Object.keys(properties)).toEqual(
      expect.arrayContaining(['items', 'budget']),
    );

    await client.close();
  });

  // Requirement 1.6: invoking an unknown tool name is reported through the MCP
  // error channel and the server keeps running.
  //
  // Observed SDK behavior (@modelcontextprotocol/sdk 1.30.1): the server raises
  // an McpError (InvalidParams, "Tool <name> not found"); the client's callTool
  // catches that error and surfaces it as a *resolved* result flagged
  // `isError: true` with a text message, rather than rejecting the promise. We
  // assert that isError result. The try/catch is retained defensively so that
  // if a future SDK version rejects instead, the caught error is asserted the
  // same way — either shape satisfies Req 1.6.
  it('reports an unknown tool as an error but keeps serving valid calls', async () => {
    const client = await connectClient();

    let unknownResult: { isError?: boolean; content?: unknown[] } | undefined;
    let caught: Error | undefined;
    try {
      unknownResult = (await client.callTool({
        name: 'does_not_exist',
        arguments: {},
      })) as { isError?: boolean; content?: unknown[] };
    } catch (err) {
      caught = err as Error;
    }

    if (caught !== undefined) {
      // Fallback path: the SDK rejected the call.
      expect(caught).toBeInstanceOf(Error);
      expect(caught.message).toMatch(/does_not_exist/);
      expect(caught.message).toMatch(/not found/i);
    } else {
      // Observed path: resolved result flagged as an error.
      expect(unknownResult?.isError).toBe(true);
      const [block] = (unknownResult?.content ?? []) as Array<{
        type: string;
        text?: string;
      }>;
      expect(block?.type).toBe('text');
      expect(block?.text).toMatch(/does_not_exist/);
      expect(block?.text).toMatch(/not found/i);
    }

    // The server must still answer a following valid pack_context call.
    const result = await client.callTool({
      name: 'pack_context',
      arguments: {
        items: [
          { id: 'a', priority: 10, tokens: 4 },
          { id: 'b', priority: 5, tokens: 3 },
        ],
        budget: 5,
      },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      selectedIds: ['a'],
      totalTokens: 4,
      budget: 5,
    });

    await client.close();
  });
});
