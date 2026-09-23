import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Resolve repository paths relative to this test file so the checks do not
// depend on the process working directory.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

function readJson(relativePath: string): unknown {
  const absolute = resolve(repoRoot, relativePath);
  return JSON.parse(readFileSync(absolute, 'utf8'));
}

describe('.kiro/settings/mcp.json', () => {
  // Requirement 5.1: the MCP config file exists and parses as JSON.
  it('parses as JSON', () => {
    expect(() => readJson('.kiro/settings/mcp.json')).not.toThrow();
  });

  // Requirement 5.2: the server is registered under the key name "ctxpack".
  it('registers the server under the key "ctxpack"', () => {
    const config = readJson('.kiro/settings/mcp.json') as {
      mcpServers?: Record<string, unknown>;
    };
    expect(config.mcpServers).toBeTypeOf('object');
    expect(config.mcpServers).toHaveProperty('ctxpack');
  });

  // Requirement 5.3: the command and args start the compiled server over stdio.
  it('starts the compiled server via node dist/mcp/index.js', () => {
    const config = readJson('.kiro/settings/mcp.json') as {
      mcpServers: Record<
        string,
        { command?: unknown; args?: unknown }
      >;
    };
    const ctxpack = config.mcpServers.ctxpack;
    expect(ctxpack).toBeDefined();
    if (ctxpack === undefined) throw new Error('ctxpack server missing');
    expect(ctxpack.command).toBe('node');
    expect(Array.isArray(ctxpack.args)).toBe(true);
    const args = ctxpack.args as string[];
    expect(args.some((arg) => arg.includes('dist/mcp/index.js'))).toBe(true);
  });

  // Requirement 5.3: the server is enabled (not disabled).
  it('is not disabled', () => {
    const config = readJson('.kiro/settings/mcp.json') as {
      mcpServers: Record<string, { disabled?: unknown }>;
    };
    const ctxpack = config.mcpServers.ctxpack;
    expect(ctxpack).toBeDefined();
    if (ctxpack === undefined) throw new Error('ctxpack server missing');
    expect(ctxpack.disabled).toBe(false);
  });

  // Requirements 5.4, 5.5: exactly one tool, pack_context, is auto-approved.
  it('auto-approves exactly ["pack_context"]', () => {
    const config = readJson('.kiro/settings/mcp.json') as {
      mcpServers: Record<string, { autoApprove?: unknown }>;
    };
    const ctxpack = config.mcpServers.ctxpack;
    expect(ctxpack).toBeDefined();
    if (ctxpack === undefined) throw new Error('ctxpack server missing');
    expect(ctxpack.autoApprove).toEqual(['pack_context']);
  });
});

describe('package.json start script', () => {
  // Requirement 4.1: a single start:mcp script points at the compiled entry.
  it('exposes start:mcp pointing at dist/mcp/index.js', () => {
    const pkg = readJson('package.json') as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts).toBeTypeOf('object');
    const startMcp = pkg.scripts?.['start:mcp'];
    expect(startMcp).toBeTypeOf('string');
    expect(startMcp).toContain('dist/mcp/index.js');
  });
});
