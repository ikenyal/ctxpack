import { describe, it, expect } from 'vitest';
import { formatPackResult } from '../../src/cli/format.js';
import type { Item, PackResult } from '../../src/core/index.js';

function result(selected: Item[], totalTokens: number): PackResult {
  return { selected, totalTokens };
}

describe('formatPackResult', () => {
  // Requirement 3.2: print the selected item ids and the total tokens.
  it('prints selected ids in order and the total tokens', () => {
    const out = formatPackResult(
      result(
        [
          { id: 'a', priority: 10, tokens: 4 },
          { id: 'b', priority: 5, tokens: 2 },
        ],
        6,
      ),
    );
    expect(out).toBe('Selected (2): a, b\nTotal tokens: 6');
  });

  // Requirement 3.2: an empty selection is rendered explicitly.
  it('renders an empty selection as "(none)" with zero total', () => {
    const out = formatPackResult(result([], 0));
    expect(out).toBe('Selected (0): (none)\nTotal tokens: 0');
  });

  it('preserves the order given by the core (does not re-sort)', () => {
    // The core already ordered these by priority desc, then id asc.
    const out = formatPackResult(
      result(
        [
          { id: 'c', priority: 9, tokens: 1 },
          { id: 'a', priority: 3, tokens: 2 },
          { id: 'b', priority: 3, tokens: 3 },
        ],
        6,
      ),
    );
    expect(out).toBe('Selected (3): c, a, b\nTotal tokens: 6');
  });

  it('does not emit a trailing newline', () => {
    const out = formatPackResult(result([{ id: 'x', priority: 1, tokens: 1 }], 1));
    expect(out.endsWith('\n')).toBe(false);
  });
});
