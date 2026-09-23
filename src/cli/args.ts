// ctxpack CLI argument parsing.
// Extracts the file path and --budget value from raw argv. Validation of the
// budget's numeric form lives in ./load (parseBudget); this module only slices
// argv into named pieces. Task 7 wires these into the core.

import { CliInputError } from './load.js';

/** Parsed CLI arguments for the `pack` command. */
export interface PackArgs {
  /** Path to the items JSON file. */
  file: string;
  /** Raw `--budget` value, or `undefined` when the flag is absent. */
  budget: string | undefined;
}

/**
 * Parse the arguments for `ctxpack pack <file> --budget <n>`.
 *
 * Accepts both `--budget 8000` and `--budget=8000` forms. The numeric validity
 * of the budget is checked later by {@link parseBudget}.
 *
 * @param argv Arguments after the `pack` subcommand.
 * @throws {CliInputError} If no file argument is provided or `--budget` is given
 *   without a value.
 */
export function parsePackArgs(argv: readonly string[]): PackArgs {
  let file: string | undefined;
  let budget: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (arg === '--budget') {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new CliInputError('Missing value for --budget <n>.');
      }
      budget = next;
      i++;
      continue;
    }

    if (arg.startsWith('--budget=')) {
      budget = arg.slice('--budget='.length);
      continue;
    }

    if (arg.startsWith('-')) {
      throw new CliInputError(`Unknown option: ${arg}`);
    }

    if (file === undefined) {
      file = arg;
      continue;
    }

    throw new CliInputError(`Unexpected extra argument: ${arg}`);
  }

  if (file === undefined) {
    throw new CliInputError('Missing required argument: <file>.');
  }

  return { file, budget };
}
