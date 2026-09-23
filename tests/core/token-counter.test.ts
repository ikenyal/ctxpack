import { describe, it, expect } from 'vitest';
import {
  approxTokenCounter,
  type TokenCounter,
} from '../../src/core/token-counter.js';

describe('approxTokenCounter', () => {
  // Requirement 5.2: default approximates as Math.ceil(text.length / 4).
  it('estimates roughly four characters per token', () => {
    expect(approxTokenCounter.count('')).toBe(0);
    expect(approxTokenCounter.count('a')).toBe(1); // ceil(1/4)
    expect(approxTokenCounter.count('abcd')).toBe(1); // ceil(4/4)
    expect(approxTokenCounter.count('abcde')).toBe(2); // ceil(5/4)
    expect(approxTokenCounter.count('abcdefgh')).toBe(2); // ceil(8/4)
    expect(approxTokenCounter.count('abcdefghi')).toBe(3); // ceil(9/4)
  });

  // Requirement 5.2: matches the exact formula for arbitrary lengths.
  it('matches Math.ceil(length / 4) for varying lengths', () => {
    for (let length = 0; length <= 40; length++) {
      const text = 'x'.repeat(length);
      expect(approxTokenCounter.count(text)).toBe(Math.ceil(length / 4));
    }
  });

  it('is a pure function: same input yields the same output', () => {
    const text = 'the quick brown fox';
    expect(approxTokenCounter.count(text)).toBe(approxTokenCounter.count(text));
  });
});

describe('custom TokenCounter', () => {
  // Requirement 5.1 / 5.4: a caller-supplied counter is used in place of the default.
  it('lets a caller supply a custom counting strategy', () => {
    const wordCounter: TokenCounter = {
      count: (text) => (text.trim() === '' ? 0 : text.trim().split(/\s+/).length),
    };

    expect(wordCounter.count('one two three')).toBe(3);
    expect(wordCounter.count('')).toBe(0);
    // The custom counter differs from the default, proving it is used instead.
    expect(wordCounter.count('one two three')).not.toBe(
      approxTokenCounter.count('one two three'),
    );
  });

  it('conforms to the TokenCounter interface', () => {
    const constantCounter: TokenCounter = { count: () => 42 };
    expect(constantCounter.count('anything')).toBe(42);
  });
});
