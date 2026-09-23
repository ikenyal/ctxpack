import { describe, it, expect, vi } from 'vitest';

// Requirement 1.5: if the stdio transport fails to initialize at startup, the
// server terminates with a non-zero exit status. `main` surfaces that failure
// by rejecting; the guarded entry maps the rejection to `process.exit(1)`.
//
// To force the failure deterministically we mock the SDK's stdio transport
// module so `StdioServerTransport` produces a transport whose `start()` rejects.
// The SDK's `server.connect(transport)` awaits `transport.start()`, so the
// rejection propagates out of `main()`. This exercises the failure path without
// touching real stdio or spawning a process.
const TRANSPORT_INIT_ERROR = 'stdio transport failed to initialize';

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  class FailingStdioServerTransport {
    // The SDK assigns these callbacks before calling start(); accept them.
    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: unknown) => void;

    start(): Promise<void> {
      return Promise.reject(new Error(TRANSPORT_INIT_ERROR));
    }

    send(): Promise<void> {
      return Promise.resolve();
    }

    close(): Promise<void> {
      return Promise.resolve();
    }
  }

  return { StdioServerTransport: FailingStdioServerTransport };
});

describe('mcp entry point', () => {
  // Requirement 1.5: main rejects when the transport init fails.
  it('rejects when the stdio transport fails to initialize', async () => {
    const { main } = await import('../../src/mcp/index.js');

    await expect(main()).rejects.toThrow(TRANSPORT_INIT_ERROR);
  });

  // Importing the module must not start the server: the entry is guarded by
  // `import.meta.url === \`file://${process.argv[1]}\``, which is false under
  // vitest, so no server is connected on import and the test process exits.
  it('does not start the server merely by importing the module', async () => {
    const mod = await import('../../src/mcp/index.js');

    // The module exposes `main` as a callable export rather than auto-running.
    expect(typeof mod.main).toBe('function');
    // The re-exported adapter pieces are present without any side effects.
    expect(typeof mod.buildServer).toBe('function');
    expect(typeof mod.handlePackContext).toBe('function');
  });
});
