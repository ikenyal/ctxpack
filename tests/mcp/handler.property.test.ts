import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { handlePackContext } from '../../src/mcp/handler.js';
import { pack, type Item } from '../../src/core/index.js';

// Field arbitraries. Priority is an arbitrary finite number (including
// negatives and ties across items); tokens is a non-negative integer. The id
// is assigned separately via uniqueArray so ids are guaranteed unique.
const priorityArb = fc.double({ noNaN: true, noDefaultInfinity: true });
const tokensArb = fc.nat({ max: 1000 });

/**
 * Generate an `Item[]` with unique ids. `uniqueArray` keyed on the generated
 * id string guarantees uniqueness; each id is then zipped with a
 * priority/tokens pair. `minLength: 0` includes the empty-items case.
 */
const itemsArb: fc.Arbitrary<Item[]> = fc
  .uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), {
    minLength: 0,
    maxLength: 20,
  })
  .chain((ids) =>
    fc.tuple(
      ...ids.map((id) =>
        fc.record({
          id: fc.constant(id),
          priority: priorityArb,
          tokens: tokensArb,
        }),
      ),
    ),
  );

const sumTokens = (items: Item[]): number =>
  items.reduce((sum, i) => sum + i.tokens, 0);

/**
 * Pair each items array with a budget that spans below, at, and above the total
 * token sum, and always includes `budget === 0`. The budget is picked from
 * `{ 0, sum, below sum, above sum }` plus an arbitrary non-negative integer so
 * the range covers all three regions relative to the sum.
 */
const itemsAndBudgetArb: fc.Arbitrary<[Item[], number]> = itemsArb.chain(
  (items) => {
    const sum = sumTokens(items);
    const budgetArb = fc.oneof(
      fc.constant(0),
      fc.constant(sum),
      fc.integer({ min: 0, max: sum }), // below/at
      fc.integer({ min: sum, max: sum + 1000 }), // at/above
      fc.nat({ max: 5000 }), // arbitrary non-negative
    );
    return fc.tuple(fc.constant(items), budgetArb);
  },
);

describe('handlePackContext — MCP delegation properties', () => {
  // Feature: ctxpack-mcp, Property 1: For any array of valid items and any non-negative integer budget, the pack_context result equals core.pack's selection (ids in order), totalTokens, and echoed budget.
  // Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.6
  it('Property 1 — delegation fidelity (handler result equals core.pack)', () => {
    fc.assert(
      fc.property(itemsAndBudgetArb, ([items, budget]) => {
        const expected = pack(items, budget);
        const result = handlePackContext({ items, budget });

        // Success result: the delegation path never flags an error.
        expect(result.isError).toBeFalsy();

        const structured = result.structuredContent as {
          selectedIds: string[];
          totalTokens: number;
          budget: number;
        };

        // selectedIds equals core's selected ids in the same order.
        expect(structured.selectedIds).toEqual(
          expected.selected.map((i) => i.id),
        );
        // totalTokens matches core's reported total.
        expect(structured.totalTokens).toBe(expected.totalTokens);
        // budget echoes the input budget unchanged.
        expect(structured.budget).toBe(budget);
      }),
      { numRuns: 200 },
    );
  });
});

// Invalid-items arbitraries. Each of these produces an `items` value that must
// fail validation: either not an array at all, or an array containing at least
// one element that mistypes id/priority/tokens.

// Non-array items: strings, numbers, objects, null, undefined — anything but an
// array. `validateItems` rejects these outright.
const nonArrayItemsArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.double({ noNaN: true }),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.record({ id: fc.string(), priority: fc.integer(), tokens: fc.nat() }),
);

// A single malformed item: exactly one field is the wrong type/value while the
// others may be well-formed. Covers numeric id, non-integer tokens, negative
// tokens, and NaN priority (plus a couple of missing-field variants).
const malformedItemArb: fc.Arbitrary<unknown> = fc.oneof(
  // numeric id (must be a string)
  fc.record({ id: fc.integer(), priority: fc.integer(), tokens: fc.nat() }),
  // non-integer (fractional) tokens
  fc.record({
    id: fc.string({ minLength: 1 }),
    priority: fc.integer(),
    tokens: fc.double({ min: 0.1, max: 999.9, noNaN: true }).filter((n) => !Number.isInteger(n)),
  }),
  // negative tokens
  fc.record({
    id: fc.string({ minLength: 1 }),
    priority: fc.integer(),
    tokens: fc.integer({ min: -1000, max: -1 }),
  }),
  // NaN priority (not finite)
  fc.record({
    id: fc.string({ minLength: 1 }),
    priority: fc.constant(Number.NaN),
    tokens: fc.nat(),
  }),
  // non-number priority
  fc.record({
    id: fc.string({ minLength: 1 }),
    priority: fc.string(),
    tokens: fc.nat(),
  }),
  // item that is not an object at all
  fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
);

// A well-formed item, used to pad arrays so the malformed element is not always
// at index 0.
const validItemArb: fc.Arbitrary<unknown> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  priority: fc.double({ noNaN: true, noDefaultInfinity: true }),
  tokens: fc.nat({ max: 1000 }),
});

// An array containing at least one malformed item (surrounded by any number of
// valid items). Guaranteed to fail `validateItems`.
const invalidItemsArrayArb: fc.Arbitrary<unknown> = fc
  .tuple(
    fc.array(validItemArb, { maxLength: 5 }),
    malformedItemArb,
    fc.array(validItemArb, { maxLength: 5 }),
  )
  .map(([before, bad, after]) => [...before, bad, ...after]);

const invalidItemsArb: fc.Arbitrary<unknown> = fc.oneof(
  nonArrayItemsArb,
  invalidItemsArrayArb,
);

// Invalid budgets: negative, fractional, NaN, infinity, and non-number types.
const invalidBudgetArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.integer({ min: -100000, max: -1 }), // negative
  fc.double({ min: 0.1, max: 9999.9, noNaN: true }).filter((n) => !Number.isInteger(n)), // fractional
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.string(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.record({ nope: fc.integer() }),
);

// A well-formed items value + budget, used both as the "valid" part when only
// one side is invalid and as the follow-up request that must still succeed.
const validItemsArb: fc.Arbitrary<Item[]> = fc.array(
  fc.record({
    id: fc.integer({ min: 0, max: 10000 }).map((n) => `id-${n}`),
    priority: fc.double({ noNaN: true, noDefaultInfinity: true }),
    tokens: fc.nat({ max: 1000 }),
  }),
  { maxLength: 8 },
);
const validBudgetArb: fc.Arbitrary<number> = fc.nat({ max: 5000 });

/**
 * Produce a `{ items, budget }` pair where at least one side is invalid:
 *  - invalid items + valid budget,
 *  - valid items + invalid budget,
 *  - invalid items + invalid budget.
 * Every generated input must therefore be rejected by the handler.
 */
const invalidInputArb: fc.Arbitrary<{ items: unknown; budget: unknown }> =
  fc.oneof(
    fc.record({ items: invalidItemsArb, budget: validBudgetArb }),
    fc.record({ items: validItemsArb, budget: invalidBudgetArb }),
    fc.record({ items: invalidItemsArb, budget: invalidBudgetArb }),
  );

describe('handlePackContext — MCP error-safety properties', () => {
  // Feature: ctxpack-mcp, Property 2: For any invalid input, the handler returns isError:true with a text message, never throws, carries no selection, and stays responsive to a subsequent valid request.
  // Validates: Requirements 3.1, 3.2, 3.4, 3.5
  it('Property 2 — error safety and no-crash on invalid input', () => {
    fc.assert(
      fc.property(invalidInputArb, (input) => {
        // The handler must never throw, whatever the invalid input.
        const result = handlePackContext(input);

        // It is flagged as an error result.
        expect(result.isError).toBe(true);

        // It carries a non-empty human-readable text message.
        expect(Array.isArray(result.content)).toBe(true);
        const textBlocks = (result.content ?? []).filter(
          (block): block is { type: 'text'; text: string } =>
            block.type === 'text',
        );
        expect(textBlocks.length).toBeGreaterThan(0);
        expect(textBlocks.some((block) => block.text.trim().length > 0)).toBe(
          true,
        );

        // No selection leaks on an error result.
        expect(result.structuredContent).toBeUndefined();

        // Stays responsive: a subsequent known-valid request still succeeds.
        const followUp = handlePackContext({
          items: [
            { id: 'a', priority: 2, tokens: 3 },
            { id: 'b', priority: 1, tokens: 4 },
          ],
          budget: 10,
        });
        expect(followUp.isError).toBeFalsy();
        expect(followUp.structuredContent).toBeDefined();
      }),
      { numRuns: 200 },
    );
  });
});

// A single well-formed item field set (unique id assigned separately below).
// Priority is an arbitrary finite number; tokens is a non-negative integer.
const duplicateFieldPairArb: fc.Arbitrary<{ priority: number; tokens: number }> =
  fc.record({
    priority: fc.double({ noNaN: true, noDefaultInfinity: true }),
    tokens: fc.nat({ max: 1000 }),
  });

/**
 * Generate an items array that is valid in every respect EXCEPT that one id is
 * duplicated. Steps:
 *  1. Generate >= 2 unique ids (so a distinct source id exists to clone).
 *  2. Build a well-formed item for each id.
 *  3. Pick a source index and a distinct target index, then overwrite the
 *     target item's id with the source item's id — forcing exactly one
 *     duplicated id while leaving every field otherwise valid.
 * The tuple also carries the duplicated id string so the assertion can check
 * the error message names it. Pair with a valid non-negative integer budget.
 */
const duplicateItemsArb: fc.Arbitrary<{
  items: Item[];
  duplicatedId: string;
}> = fc
  .uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), {
    minLength: 2,
    maxLength: 20,
  })
  .chain((ids) =>
    fc
      .tuple(
        fc.constant(ids),
        fc.tuple(...ids.map(() => duplicateFieldPairArb)),
        fc.nat({ max: ids.length - 1 }), // source index
        fc.nat({ max: ids.length - 1 }), // raw target index
      )
      .map(([uniqueIds, fields, sourceIdx, rawTargetIdx]) => {
        // Ensure target differs from source so a real duplicate is created.
        const targetIdx =
          rawTargetIdx === sourceIdx
            ? (rawTargetIdx + 1) % uniqueIds.length
            : rawTargetIdx;
        const duplicatedId = uniqueIds[sourceIdx]!;
        const items: Item[] = uniqueIds.map((id, i) => ({
          id,
          priority: fields[i]!.priority,
          tokens: fields[i]!.tokens,
        }));
        // Clone the source id onto the target, forcing a duplicate.
        items[targetIdx] = { ...items[targetIdx]!, id: duplicatedId };
        return { items, duplicatedId };
      }),
  );

const duplicateInputArb: fc.Arbitrary<{
  items: Item[];
  duplicatedId: string;
  budget: number;
}> = duplicateItemsArb.chain(({ items, duplicatedId }) =>
  fc.record({
    items: fc.constant(items),
    duplicatedId: fc.constant(duplicatedId),
    budget: fc.nat({ max: 5000 }),
  }),
);

describe('handlePackContext — MCP duplicate-id property', () => {
  // Feature: ctxpack-mcp, Property 3: For any items array with a duplicated id and a valid budget, the handler catches core's error, returns isError:true whose message includes the duplicated id, and does not throw.
  // Validates: Requirements 3.3
  it('Property 3 — duplicate ids surface as a tool error naming the id', () => {
    fc.assert(
      fc.property(duplicateInputArb, ({ items, duplicatedId, budget }) => {
        // The handler must never throw, even though core.pack throws on the
        // duplicate id — the handler catches it.
        const result = handlePackContext({ items, budget });

        // It is flagged as an error result.
        expect(result.isError).toBe(true);

        // No selection leaks on an error result.
        expect(result.structuredContent).toBeUndefined();

        // The error message names the duplicated id.
        const textBlocks = (result.content ?? []).filter(
          (block): block is { type: 'text'; text: string } =>
            block.type === 'text',
        );
        expect(textBlocks.length).toBeGreaterThan(0);
        const message = textBlocks.map((block) => block.text).join('\n');
        expect(message).toContain(duplicatedId);
      }),
      { numRuns: 200 },
    );
  });
});
