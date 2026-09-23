// ctxpack CLI orchestration.
// Wires the CLI adapters (arg parsing, file loading, budget parsing) to the
// core packer and formats the result. Selection logic lives entirely in the
// core; this module only delegates. Kept free of process globals so it can be
// unit-tested: it returns text and an exit code instead of touching stdout,
// stderr, or process.exit directly.

import { pack } from '../core/index.js';
import { parsePackArgs } from './args.js';
import { CliInputError, loadItemsFile, parseBudget } from './load.js';
import { formatPackResult } from './format.js';

/** Outcome of a CLI invocation: text streams plus a process exit code. */
export interface CliResult {
  /** Text to write to stdout (empty on failure). */
  stdout: string;
  /** Text to write to stderr (empty on success). */
  stderr: string;
  /** Process exit code: `0` on success, non-zero on failure. */
  exitCode: number;
}

/**
 * Run the `ctxpack pack <file> --budget <n>` command.
 *
 * Flow: parse args -> load and validate items -> parse the budget -> delegate
 * selection to `core.pack` -> format the result. Any {@link CliInputError} or
 * other error (for example the core's duplicate-id `Error`) is caught and
 * turned into a descriptive stderr message with a non-zero exit code, so the
 * caller never faces an uncaught exception.
 *
 * @param argv Arguments after the program name (i.e. `process.argv.slice(2)`).
 * @returns The stdout/stderr text and exit code; this function never throws.
 */
export function run(argv: readonly string[]): CliResult {
  try {
    const [command, ...rest] = argv;

    if (command !== 'pack') {
      const shown = command === undefined ? '(none)' : command;
      throw new CliInputError(
        `Unknown command: ${shown}. Usage: ctxpack pack <file> --budget <n>`,
      );
    }

    const { file, budget: rawBudget } = parsePackArgs(rest);
    const items = loadItemsFile(file);
    const budget = parseBudget(rawBudget);

    // Selection is fully delegated to the core; the CLI adds no packing logic.
    const result = pack(items, budget);

    return { stdout: formatPackResult(result), stderr: '', exitCode: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { stdout: '', stderr: `error: ${message}`, exitCode: 1 };
  }
}
