import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CliInputError,
  loadItemsFile,
  parseItems,
  parseBudget,
} from '../../src/cli/load.js';
import type { Item } from '../../src/core/index.js';

// Track temp dirs so each test can clean up after itself.
const tempDirs: string[] = [];

function writeTempFile(name: string, contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ctxpack-cli-'));
  tempDirs.push(dir);
  const path = join(dir, name);
  writeFileSync(path, contents, 'utf8');
  return path;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('loadItemsFile', () => {
  // Requirement 3.1: read the JSON file and parse it into a list of items.
  it('reads and parses a valid items file', () => {
    const items: Item[] = [
      { id: 'a', priority: 10, tokens: 4 },
      { id: 'b', priority: 5, tokens: 2 },
    ];
    const path = writeTempFile('items.json', JSON.stringify(items));

    expect(loadItemsFile(path)).toEqual(items);
  });

  // Requirement 3.3: a missing/unreadable file is a descriptive CliInputError.
  it('throws a descriptive error when the file does not exist', () => {
    const missing = join(tmpdir(), 'ctxpack-does-not-exist-12345.json');
    expect(() => loadItemsFile(missing)).toThrow(CliInputError);
    expect(() => loadItemsFile(missing)).toThrow(/Cannot read file/);
  });
});

describe('parseItems', () => {
  // Requirement 3.1: valid JSON array of items parses successfully.
  it('parses a valid JSON array of items', () => {
    const items: Item[] = [{ id: 'x', priority: 1, tokens: 0 }];
    expect(parseItems(JSON.stringify(items), 'src')).toEqual(items);
  });

  // Requirement 3.4: content that is not valid JSON is rejected.
  it('throws on invalid JSON', () => {
    expect(() => parseItems('{ not json', 'src')).toThrow(CliInputError);
    expect(() => parseItems('{ not json', 'src')).toThrow(/Invalid JSON/);
  });

  // Requirement 3.4: valid JSON that is not an array is rejected.
  it('throws when the top-level value is not an array', () => {
    expect(() => parseItems('{"id":"a"}', 'src')).toThrow(
      /expected a JSON array/,
    );
  });

  // Requirement 3.4: an element that is not an object is rejected.
  it('throws when an element is not an object', () => {
    expect(() => parseItems('[42]', 'src')).toThrow(/expected an object/);
  });

  // Requirement 3.4: a missing/mistyped id is rejected.
  it('throws when id is missing or not a string', () => {
    const raw = JSON.stringify([{ priority: 1, tokens: 1 }]);
    expect(() => parseItems(raw, 'src')).toThrow(/"id" must be a string/);
  });

  // Requirement 3.4: a non-finite priority is rejected.
  it('throws when priority is not a finite number', () => {
    const raw = JSON.stringify([{ id: 'a', priority: 'high', tokens: 1 }]);
    expect(() => parseItems(raw, 'src')).toThrow(
      /"priority" must be a finite number/,
    );
  });

  // Requirement 3.4: a negative or non-integer tokens value is rejected.
  it('throws when tokens is negative', () => {
    const raw = JSON.stringify([{ id: 'a', priority: 1, tokens: -1 }]);
    expect(() => parseItems(raw, 'src')).toThrow(
      /"tokens" must be a non-negative integer/,
    );
  });

  it('throws when tokens is not an integer', () => {
    const raw = JSON.stringify([{ id: 'a', priority: 1, tokens: 1.5 }]);
    expect(() => parseItems(raw, 'src')).toThrow(
      /"tokens" must be a non-negative integer/,
    );
  });

  // Zero tokens and negative/zero priority are valid.
  it('accepts zero tokens and any finite priority', () => {
    const items: Item[] = [{ id: 'z', priority: -3, tokens: 0 }];
    expect(parseItems(JSON.stringify(items), 'src')).toEqual(items);
  });
});

describe('parseBudget', () => {
  // Requirement 3.5: a valid non-negative integer parses.
  it('parses a non-negative integer', () => {
    expect(parseBudget('8000')).toBe(8000);
    expect(parseBudget('0')).toBe(0);
    expect(parseBudget('  42  ')).toBe(42);
  });

  // Requirement 3.5: a missing budget is rejected.
  it('throws when the budget is missing', () => {
    expect(() => parseBudget(undefined)).toThrow(CliInputError);
    expect(() => parseBudget(undefined)).toThrow(/Missing required option/);
  });

  // Requirement 3.5: a negative budget is rejected.
  it('throws on a negative budget', () => {
    expect(() => parseBudget('-1')).toThrow(/non-negative integer/);
  });

  // Requirement 3.5: a non-integer budget is rejected.
  it('throws on a non-integer budget', () => {
    expect(() => parseBudget('3.5')).toThrow(/non-negative integer/);
    expect(() => parseBudget('abc')).toThrow(/non-negative integer/);
    expect(() => parseBudget('')).toThrow(/non-negative integer/);
  });

  it('throws on a budget that is too large to represent exactly', () => {
    expect(() => parseBudget('99999999999999999999')).toThrow(/too large/);
  });
});
