#!/usr/bin/env node
// ctxpack CLI entry point.
// Thin adapter: parses argv, loads items, and delegates selection to the core,
// then prints the formatted result. All packing logic lives in `src/core/`.
// The orchestration is in ./run (returns text + exit code, no process globals),
// which keeps this file's only responsibility the process-level plumbing.

import { run } from './run.js';

// Re-export the adapter pieces so tests and other tooling can import them.
export { CliInputError, loadItemsFile, parseItems, parseBudget } from './load.js';
export { parsePackArgs, type PackArgs } from './args.js';
export { formatPackResult } from './format.js';
export { run, type CliResult } from './run.js';

/**
 * Process entry: run the CLI over `process.argv`, write the captured stdout /
 * stderr text to the real streams, and exit with the returned code.
 */
export function main(): void {
  const { stdout, stderr, exitCode } = run(process.argv.slice(2));
  if (stdout) {
    process.stdout.write(`${stdout}\n`);
  }
  if (stderr) {
    process.stderr.write(`${stderr}\n`);
  }
  process.exit(exitCode);
}

// Only run when invoked as a script, not when imported (e.g. by tests).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
