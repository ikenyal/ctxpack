import { describe, it, expect } from 'vitest';
import { parsePackArgs } from '../../src/cli/args.js';
import { CliInputError } from '../../src/cli/load.js';

describe('parsePackArgs', () => {
  it('parses "<file> --budget <n>"', () => {
    expect(parsePackArgs(['items.json', '--budget', '8000'])).toEqual({
      file: 'items.json',
      budget: '8000',
    });
  });

  it('parses the "--budget=<n>" form', () => {
    expect(parsePackArgs(['items.json', '--budget=8000'])).toEqual({
      file: 'items.json',
      budget: '8000',
    });
  });

  it('parses the file when --budget comes first', () => {
    expect(parsePackArgs(['--budget', '10', 'items.json'])).toEqual({
      file: 'items.json',
      budget: '10',
    });
  });

  it('leaves budget undefined when the flag is absent', () => {
    expect(parsePackArgs(['items.json'])).toEqual({
      file: 'items.json',
      budget: undefined,
    });
  });

  it('throws when no file argument is given', () => {
    expect(() => parsePackArgs(['--budget', '10'])).toThrow(CliInputError);
    expect(() => parsePackArgs(['--budget', '10'])).toThrow(
      /Missing required argument/,
    );
  });

  it('throws when --budget has no value', () => {
    expect(() => parsePackArgs(['items.json', '--budget'])).toThrow(
      /Missing value for --budget/,
    );
  });

  it('throws on an unknown option', () => {
    expect(() => parsePackArgs(['items.json', '--verbose'])).toThrow(
      /Unknown option/,
    );
  });

  it('throws on an unexpected extra positional argument', () => {
    expect(() => parsePackArgs(['a.json', 'b.json'])).toThrow(
      /Unexpected extra argument/,
    );
  });
});
