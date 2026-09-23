import { describe, it, expect } from 'vitest';
import {
  McpInputError,
  validateItems,
  validateBudget,
} from '../../src/mcp/validate.js';
import type { Item } from '../../src/core/index.js';

describe('validateItems', () => {
  // Requirement 3.1: a valid array of items passes and is returned as Item[].
  it('accepts a valid array of items', () => {
    const items: Item[] = [
      { id: 'a', priority: 10, tokens: 4 },
      { id: 'b', priority: 5, tokens: 2 },
    ];
    expect(validateItems(items)).toEqual(items);
  });

  // Requirement 3.1: zero tokens and any finite priority (incl. negatives) are valid.
  it('accepts zero tokens and any finite priority', () => {
    const items: Item[] = [{ id: 'z', priority: -3, tokens: 0 }];
    expect(validateItems(items)).toEqual(items);
  });

  // Requirement 3.1: an empty array is valid.
  it('accepts an empty array', () => {
    expect(validateItems([])).toEqual([]);
  });

  // Requirement 3.1: a non-array value is rejected.
  it('throws when the value is not an array', () => {
    expect(() => validateItems({ id: 'a' })).toThrow(McpInputError);
    expect(() => validateItems({ id: 'a' })).toThrow(
      /expected an array of items/,
    );
  });

  // Requirement 3.1: an element that is not an object is rejected.
  it('throws when an element is not an object', () => {
    expect(() => validateItems([42])).toThrow(McpInputError);
    expect(() => validateItems([42])).toThrow(/expected an object/);
  });

  // Requirement 3.1: a missing/non-string id is rejected.
  it('throws when id is not a string', () => {
    expect(() => validateItems([{ id: 1, priority: 1, tokens: 1 }])).toThrow(
      /"id" must be a string/,
    );
  });

  // Requirement 3.1: a non-finite (NaN) priority is rejected.
  it('throws when priority is NaN', () => {
    expect(() =>
      validateItems([{ id: 'a', priority: Number.NaN, tokens: 1 }]),
    ).toThrow(/"priority" must be a finite number/);
  });

  // Requirement 3.1: a non-number priority is rejected.
  it('throws when priority is not a number', () => {
    expect(() =>
      validateItems([{ id: 'a', priority: 'high', tokens: 1 }]),
    ).toThrow(/"priority" must be a finite number/);
  });

  // Requirement 3.1: a negative tokens value is rejected.
  it('throws when tokens is negative', () => {
    expect(() =>
      validateItems([{ id: 'a', priority: 1, tokens: -1 }]),
    ).toThrow(/"tokens" must be a non-negative integer/);
  });

  // Requirement 3.1: a non-integer (fractional) tokens value is rejected.
  it('throws when tokens is not an integer', () => {
    expect(() =>
      validateItems([{ id: 'a', priority: 1, tokens: 1.5 }]),
    ).toThrow(/"tokens" must be a non-negative integer/);
  });
});

describe('validateBudget', () => {
  // Requirement 3.2: a non-negative integer budget passes and is returned.
  it('accepts a non-negative integer', () => {
    expect(validateBudget(8000)).toBe(8000);
    expect(validateBudget(0)).toBe(0);
  });

  // Requirement 3.2: a negative budget is rejected.
  it('throws on a negative budget', () => {
    expect(() => validateBudget(-1)).toThrow(McpInputError);
    expect(() => validateBudget(-1)).toThrow(/non-negative integer/);
  });

  // Requirement 3.2: a fractional budget is rejected.
  it('throws on a fractional budget', () => {
    expect(() => validateBudget(3.5)).toThrow(/non-negative integer/);
  });

  // Requirement 3.2: a non-number budget is rejected.
  it('throws on a non-number budget', () => {
    expect(() => validateBudget('8000')).toThrow(/non-negative integer/);
    expect(() => validateBudget(Number.NaN)).toThrow(/non-negative integer/);
  });

  // Requirement 3.2: a budget too large to represent exactly is rejected.
  it('throws on a budget that is too large to represent exactly', () => {
    expect(() => validateBudget(2 ** 53)).toThrow(/too large/);
  });
});
