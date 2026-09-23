import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../src/cli/run.js';
import type { Item } from '../../src/core/index.js';

// Track temp dirs so each test can clean up after itself.
const tempDirs: string[] = [];

function writeItemsFile(items: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'ctxpack-run-'));
  tempDirs.push(dir);
  const path = join(dir, 'items.json');
  writeFileSync(path, JSON.stringify(items), 'utf8');
  return path;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('run', () => {
  // Requirement 3.1 + 3.2: read the file, delegate to the core, print ids + total.
  it('packs items from a file and prints the selected ids and total tokens', () => {
    const items: Item[] = [
      { id: 'a', priority: 10, tokens: 4 },
      { id: 'b', priority: 5, tokens: 2 },
      { id: 'c', priority: 1, tokens: 5 },
    ];
    const path = writeItemsFile(items);

    // Budget 6 fits a (4) then b (2); c (5) does not fit -> priority-prefix stops.
    const res = run(['pack', path, '--budget', '6']);

    expect(res.exitCode).toBe(0);
    expect(res.stderr).toBe('');
    expect(res.stdout).toBe('Selected (2): a, b\nTotal tokens: 6');
  });

  // Requirement 2.2/2.3: output order is priority desc, then id asc, regardless
  // of input order.
  it('produces deterministic order (priority desc, then id asc)', () => {
    const items: Item[] = [
      { id: 'b', priority: 3, tokens: 2 },
      { id: 'a', priority: 3, tokens: 2 },
      { id: 'z', priority: 9, tokens: 1 },
    ];
    const path = writeItemsFile(items);

    const res = run(['pack', path, '--budget', '100']);

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe('Selected (3): z, a, b\nTotal tokens: 5');
  });

  // Requirement 1.4: a zero budget selects nothing (no zero-token items here).
  it('prints an empty selection when the budget is 0', () => {
    const items: Item[] = [{ id: 'a', priority: 1, tokens: 3 }];
    const path = writeItemsFile(items);

    const res = run(['pack', path, '--budget', '0']);

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe('Selected (0): (none)\nTotal tokens: 0');
  });

  // Requirement 1.4: zero-token items at the front of the prefix are selected
  // even at budget 0.
  it('selects zero-token items at budget 0', () => {
    const items: Item[] = [
      { id: 'free', priority: 5, tokens: 0 },
      { id: 'paid', priority: 1, tokens: 2 },
    ];
    const path = writeItemsFile(items);

    const res = run(['pack', path, '--budget', '0']);

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe('Selected (1): free\nTotal tokens: 0');
  });

  // Everything overflows -> empty selection.
  it('prints an empty selection when every item overflows the budget', () => {
    const items: Item[] = [
      { id: 'a', priority: 5, tokens: 10 },
      { id: 'b', priority: 4, tokens: 20 },
    ];
    const path = writeItemsFile(items);

    const res = run(['pack', path, '--budget', '3']);

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe('Selected (0): (none)\nTotal tokens: 0');
  });

  // Requirement 3.3: a missing file is reported to stderr with a non-zero code.
  it('reports a missing file to stderr and exits non-zero', () => {
    const missing = join(tmpdir(), 'ctxpack-run-missing-12345.json');
    const res = run(['pack', missing, '--budget', '10']);

    expect(res.exitCode).not.toBe(0);
    expect(res.stdout).toBe('');
    expect(res.stderr).toMatch(/Cannot read file/);
  });

  // Requirement 3.5: an invalid budget is reported to stderr with a non-zero code.
  it('reports an invalid budget to stderr and exits non-zero', () => {
    const path = writeItemsFile([{ id: 'a', priority: 1, tokens: 1 }]);
    const res = run(['pack', path, '--budget', '-1']);

    expect(res.exitCode).not.toBe(0);
    expect(res.stdout).toBe('');
    expect(res.stderr).toMatch(/non-negative integer/);
  });

  // Requirement 3.4: bad item shape is reported to stderr with a non-zero code.
  it('reports invalid item shape to stderr and exits non-zero', () => {
    const path = writeItemsFile([{ id: 'a', priority: 1, tokens: -5 }]);
    const res = run(['pack', path, '--budget', '10']);

    expect(res.exitCode).not.toBe(0);
    expect(res.stderr).toMatch(/non-negative integer/);
  });

  // The core throws a plain Error on duplicate ids; run() must catch it, not leak
  // an uncaught exception.
  it('reports the core duplicate-id error to stderr without throwing', () => {
    const items: Item[] = [
      { id: 'dup', priority: 2, tokens: 1 },
      { id: 'dup', priority: 1, tokens: 1 },
    ];
    const path = writeItemsFile(items);

    const res = run(['pack', path, '--budget', '10']);

    expect(res.exitCode).not.toBe(0);
    expect(res.stdout).toBe('');
    expect(res.stderr).toMatch(/Duplicate id: dup/);
  });

  // An unknown/missing command is a descriptive error, not a crash.
  it('reports an unknown command to stderr and exits non-zero', () => {
    const res = run(['frobnicate']);
    expect(res.exitCode).not.toBe(0);
    expect(res.stderr).toMatch(/Unknown command/);
  });
});
