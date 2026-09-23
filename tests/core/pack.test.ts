import { describe, it, expect } from 'vitest';
import { pack, type Item } from '../../src/core/model.js';

const item = (id: string, priority: number, tokens: number): Item => ({
  id,
  priority,
  tokens,
});

describe('pack', () => {
  // Requirement 1.1 / 1.2: sort by priority desc (then id asc) and add each item
  // whose tokens fit within the remaining budget.
  it('packs the highest-priority items that fit and reports the total', () => {
    const items: Item[] = [
      item('a', 1, 3),
      item('b', 10, 4),
      item('c', 5, 2),
    ];

    const result = pack(items, 10);

    // priority desc: b(10), c(5), a(1). 4 + 2 + 3 = 9 <= 10.
    expect(result.selected.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(result.totalTokens).toBe(9);
  });

  // Requirement 1.3: stop at the first item that does not fit; do not consider
  // later (smaller) items that would otherwise fit.
  it('stops at the first item that does not fit (never skip-and-continue)', () => {
    const items: Item[] = [
      item('big', 10, 8),
      item('mid', 5, 5),
      item('small', 1, 1), // would fit in the leftover budget, but must be skipped
    ];

    const result = pack(items, 10);

    // big(8) fits, mid(5) overflows -> stop. small is NOT considered.
    expect(result.selected.map((i) => i.id)).toEqual(['big']);
    expect(result.totalTokens).toBe(8);
  });

  // Requirement 1.5: an empty list returns an empty selection.
  it('returns an empty result for an empty list', () => {
    const result = pack([], 100);
    expect(result.selected).toEqual([]);
    expect(result.totalTokens).toBe(0);
  });

  // Requirement 1.4: budget 0 returns an empty set when no zero-token items lead.
  it('returns an empty selection for zero budget with only non-zero items', () => {
    const items: Item[] = [item('a', 5, 1), item('b', 3, 2)];
    const result = pack(items, 0);
    expect(result.selected).toEqual([]);
    expect(result.totalTokens).toBe(0);
  });

  // Requirement 1.4: budget 0 still selects the leading run of zero-token items,
  // and stops at the first item with a positive token count.
  it('selects only the leading zero-token items under a zero budget', () => {
    const items: Item[] = [
      item('z1', 10, 0),
      item('z2', 8, 0),
      item('paid', 5, 1),
      item('z3', 1, 0), // after a positive-token item -> excluded (stop-at-overflow)
    ];

    const result = pack(items, 0);

    expect(result.selected.map((i) => i.id)).toEqual(['z1', 'z2']);
    expect(result.totalTokens).toBe(0);
  });

  // Requirement 2.4: duplicate ids are rejected with an error.
  it('throws when two items share the same id', () => {
    const items: Item[] = [
      item('dup', 5, 1),
      item('other', 3, 1),
      item('dup', 1, 1),
    ];
    expect(() => pack(items, 100)).toThrow('Duplicate id: dup');
  });

  it('does not mutate the input array (purity)', () => {
    const items: Item[] = [item('a', 1, 1), item('b', 10, 1)];
    const snapshot = [...items];
    pack(items, 100);
    expect(items).toEqual(snapshot);
  });
});
