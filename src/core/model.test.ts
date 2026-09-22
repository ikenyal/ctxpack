import { describe, it, expect } from 'vitest';
import { compareItems, type Item } from './model.js';

const item = (id: string, priority: number, tokens = 0): Item => ({
  id,
  priority,
  tokens,
});

describe('compareItems', () => {
  // Requirement 1.1 / 2.2: sort by priority descending.
  it('orders higher priority before lower priority', () => {
    const high = item('a', 10);
    const low = item('b', 1);
    expect(compareItems(high, low)).toBeLessThan(0);
    expect(compareItems(low, high)).toBeGreaterThan(0);
  });

  // Requirement 2.3: equal priority is broken by id ascending.
  it('breaks equal-priority ties by id ascending', () => {
    const first = item('alpha', 5);
    const second = item('beta', 5);
    expect(compareItems(first, second)).toBeLessThan(0);
    expect(compareItems(second, first)).toBeGreaterThan(0);
  });

  it('returns 0 for identical priority and id', () => {
    expect(compareItems(item('x', 5, 1), item('x', 5, 99))).toBe(0);
  });

  it('prioritizes priority over id (higher priority wins even with larger id)', () => {
    const highPriorityLateId = item('zzz', 10);
    const lowPriorityEarlyId = item('aaa', 1);
    expect(compareItems(highPriorityLateId, lowPriorityEarlyId)).toBeLessThan(0);
  });

  // Requirement 2.2: the comparator yields a deterministic total order.
  it('produces a stable, deterministic ordering when sorting', () => {
    const items: Item[] = [
      item('c', 5),
      item('a', 5),
      item('b', 10),
      item('d', 1),
      item('a2', 5),
    ];

    const sorted = [...items].sort(compareItems).map((i) => i.id);
    // priority desc: 10 (b), then 5 (a, a2, c by id asc), then 1 (d)
    expect(sorted).toEqual(['b', 'a', 'a2', 'c', 'd']);
  });

  it('sorts identically regardless of input order (order independence of the comparator)', () => {
    const base: Item[] = [
      item('c', 5),
      item('a', 5),
      item('b', 10),
      item('d', 1),
    ];
    const shuffled: Item[] = [
      item('d', 1),
      item('b', 10),
      item('c', 5),
      item('a', 5),
    ];

    const sortById = (xs: Item[]) => [...xs].sort(compareItems).map((i) => i.id);
    expect(sortById(base)).toEqual(sortById(shuffled));
  });

  // A comparator must be consistent (antisymmetric) to induce a total order.
  it('is antisymmetric: sign flips when arguments swap', () => {
    const a = item('a', 5);
    const b = item('b', 7);
    expect(Math.sign(compareItems(a, b))).toBe(-Math.sign(compareItems(b, a)));
  });
});
