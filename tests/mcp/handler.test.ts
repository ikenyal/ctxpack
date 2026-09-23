import { describe, it, expect } from 'vitest';
import { handlePackContext } from '../../src/mcp/handler.js';
import type { Item } from '../../src/core/index.js';

/** Narrow a tool-result content block to its text, asserting it is a text block. */
function textOf(result: ReturnType<typeof handlePackContext>): string {
  const [block] = result.content ?? [];
  expect(block).toBeDefined();
  expect(block?.type).toBe('text');
  return (block as { type: 'text'; text: string }).text;
}

describe('handlePackContext', () => {
  // Requirement 2.3 / 2.4: a concrete selection is returned in core's
  // deterministic order (priority desc, then id asc) with the total tokens and
  // the applied budget echoed back.
  it('returns a known selection with totals and echoed budget', () => {
    const items: Item[] = [
      { id: 'a', priority: 1, tokens: 3 },
      { id: 'b', priority: 10, tokens: 4 },
      { id: 'c', priority: 5, tokens: 2 },
    ];

    const result = handlePackContext({ items, budget: 10 });

    // priority desc: b(10), c(5), a(1); 4 + 2 + 3 = 9 <= 10.
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      selectedIds: ['b', 'c', 'a'],
      totalTokens: 9,
      budget: 10,
    });
    // The text summary reflects the same selection and totals.
    const text = textOf(result);
    expect(text).toContain('b, c, a');
    expect(text).toContain('9');
    expect(text).toContain('10');
  });

  // Requirement 2.5: an empty items list yields an empty selection and a total
  // of 0, with the applied budget echoed back (not an error).
  it('returns an empty selection for empty items (Req 2.5)', () => {
    const result = handlePackContext({ items: [], budget: 100 });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      selectedIds: [],
      totalTokens: 0,
      budget: 100,
    });
    // With no ids the summary reports "(none)" rather than a list.
    expect(textOf(result)).toContain('(none)');
  });

  // Requirement 3.6: a budget of 0 is valid input, delegated to core. Only a
  // leading run of zero-token items is selected; the first positive-token item
  // stops packing.
  it('treats budget 0 as valid and selects only leading zero-token items (Req 3.6)', () => {
    const items: Item[] = [
      { id: 'z1', priority: 10, tokens: 0 },
      { id: 'z2', priority: 8, tokens: 0 },
      { id: 'paid', priority: 5, tokens: 1 },
    ];

    const result = handlePackContext({ items, budget: 0 });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      selectedIds: ['z1', 'z2'],
      totalTokens: 0,
      budget: 0,
    });
  });

  // Requirement 3.1: a malformed item yields an isError result whose message
  // names the violated constraint, and carries no selection payload.
  it('reports a malformed item as an error with no selection (Req 3.1)', () => {
    const result = handlePackContext({
      items: [{ id: 'a', priority: 1, tokens: -1 }],
      budget: 10,
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(textOf(result)).toMatch(/"tokens" must be a non-negative integer/);
  });

  // Requirement 3.2: an invalid budget yields an isError result whose message
  // indicates the invalid budget, and carries no selection payload.
  it('reports an invalid budget as an error with no selection (Req 3.2)', () => {
    const result = handlePackContext({
      items: [{ id: 'a', priority: 1, tokens: 1 }],
      budget: -5,
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(textOf(result)).toMatch(/non-negative integer/);
  });
});
