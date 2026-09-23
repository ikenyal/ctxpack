// ctxpack MCP input validation.
// Mirrors the CLI validation rules (see src/cli/load.ts) but with an
// MCP-specific error type. The MCP layer must not import from cli or web; it
// depends only on core for the shared `Item` type. Contains no selection logic.

import type { Item } from '../core/index.js';

/**
 * Recoverable MCP input error. The pack_context handler catches it and returns
 * an `isError` tool result rather than letting it escape the process.
 */
export class McpInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpInputError';
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate that an unknown value has the {@link Item} shape:
 * `id` (string), `priority` (finite number), `tokens` (non-negative integer).
 *
 * @param value The value to validate.
 * @param index Position in the source array, used for a descriptive message.
 * @throws {McpInputError} If the value is not a valid item.
 */
function validateItem(value: unknown, index: number): Item {
  const where = `item at index ${index}`;
  if (!isPlainObject(value)) {
    throw new McpInputError(`Invalid ${where}: expected an object.`);
  }

  const { id, priority, tokens } = value;

  if (typeof id !== 'string') {
    throw new McpInputError(`Invalid ${where}: "id" must be a string.`);
  }
  if (typeof priority !== 'number' || !Number.isFinite(priority)) {
    throw new McpInputError(
      `Invalid ${where} (id "${id}"): "priority" must be a finite number.`,
    );
  }
  if (
    typeof tokens !== 'number' ||
    !Number.isInteger(tokens) ||
    tokens < 0
  ) {
    throw new McpInputError(
      `Invalid ${where} (id "${id}"): "tokens" must be a non-negative integer.`,
    );
  }

  return { id, priority, tokens };
}

/**
 * Validate an unknown value as an `Item[]`. The value must be an array, and each
 * element must match the item shape (string `id`, finite `priority`,
 * non-negative integer `tokens`).
 *
 * @param value The value to validate (typically the `items` tool argument).
 * @throws {McpInputError} Describing the first violated constraint.
 */
export function validateItems(value: unknown): Item[] {
  if (!Array.isArray(value)) {
    throw new McpInputError('Invalid items: expected an array of items.');
  }
  return value.map((item, index) => validateItem(item, index));
}

/**
 * Validate a budget value: it must be an integer greater than or equal to 0.
 * Unlike the CLI's `parseBudget`, the MCP budget arrives as a JSON number, so
 * this checks the number directly with `Number.isInteger` and a safe-integer
 * upper bound rather than parsing a string.
 *
 * @param value The value to validate (typically the `budget` tool argument).
 * @throws {McpInputError} Describing the invalid budget.
 */
export function validateBudget(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new McpInputError(
      `Invalid budget "${String(value)}": must be a non-negative integer.`,
    );
  }
  if (!Number.isSafeInteger(value)) {
    throw new McpInputError(
      `Invalid budget "${String(value)}": value is too large.`,
    );
  }
  return value;
}
