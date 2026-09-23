// ctxpack CLI output formatting.
// Pure function turning a core PackResult into the text the CLI prints. Kept
// separate from process I/O so it can be unit-tested without spawning a process.
// Contains no selection logic; it only renders a result the core produced.

import type { PackResult } from '../core/index.js';

/**
 * Render a {@link PackResult} as the CLI's stdout text.
 *
 * The output lists the selected item `id`s (already in the core's deterministic
 * order: `priority` descending, then `id` ascending) followed by the total
 * tokens of the selected set. When nothing is selected, the id list reads
 * `(none)`.
 *
 * @param result The result returned by `core.pack`.
 * @returns A multi-line string without a trailing newline.
 */
export function formatPackResult(result: PackResult): string {
  const ids =
    result.selected.length > 0
      ? result.selected.map((item) => item.id).join(', ')
      : '(none)';
  return [
    `Selected (${result.selected.length}): ${ids}`,
    `Total tokens: ${result.totalTokens}`,
  ].join('\n');
}
