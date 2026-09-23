// ctxpack MCP pack_context handler.
// Thin adapter: validate + shape input, delegate all selection to core.pack,
// then shape the result into an MCP tool response. Holds no selection logic and
// never imports from cli or web (depends only on core and this layer's
// validation). Never throws: every recoverable error becomes an isError result.

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { pack } from '../core/index.js';
import { validateBudget, validateItems } from './validate.js';

/** Raw arguments for the `pack_context` tool. Validated inside the handler. */
export interface PackContextInput {
  /** Candidate items; validated to `Item[]` inside the handler. */
  items: unknown;
  /** Token budget; validated to a non-negative integer inside the handler. */
  budget: unknown;
}

/** Structured success payload returned in `structuredContent`. */
export interface PackContextOutput {
  /** Ids of selected items in core's deterministic order. */
  selectedIds: string[];
  /** Sum of tokens across the selection. */
  totalTokens: number;
  /** The budget that was applied. */
  budget: number;
}

/**
 * Handle a `pack_context` call.
 *
 * Validates {@link PackContextInput.items} and {@link PackContextInput.budget},
 * delegates the selection to the pure core `pack(items, budget)`, and shapes the
 * outcome into a {@link CallToolResult}. On success the result carries a
 * {@link PackContextOutput} in `structuredContent` plus a human-readable text
 * summary. Any error (bad item shape, invalid budget, or a duplicate-id `Error`
 * from core) is caught and mapped to `{ isError: true, content: [text] }` with
 * no `structuredContent`, so no selection leaks and the server keeps running.
 *
 * @param input The raw tool arguments.
 * @returns A tool result; never throws.
 */
export function handlePackContext(input: PackContextInput): CallToolResult {
  try {
    const items = validateItems(input.items);
    const budget = validateBudget(input.budget);
    const result = pack(items, budget);

    const structuredContent: PackContextOutput = {
      selectedIds: result.selected.map((item) => item.id),
      totalTokens: result.totalTokens,
      budget,
    };

    const ids =
      structuredContent.selectedIds.length > 0
        ? structuredContent.selectedIds.join(', ')
        : '(none)';
    const text = [
      `Selected ${structuredContent.selectedIds.length} item(s): ${ids}`,
      `Total tokens: ${structuredContent.totalTokens} / budget ${budget}`,
    ].join('\n');

    return {
      structuredContent: { ...structuredContent },
      content: [{ type: 'text', text }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: 'text', text: message }],
    };
  }
}
