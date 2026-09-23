// ctxpack CLI input loading and validation.
// Reads an items JSON file and validates the --budget argument, reusing the
// core `Item` type. Contains no selection logic; selection is delegated to the
// core in a later step. This module never imports web; it depends only on core.

import { readFileSync } from 'node:fs';
import type { Item } from '../core/index.js';

/**
 * Error raised for any recoverable CLI input problem (missing/unreadable file,
 * invalid JSON, bad item shape, or invalid budget). The CLI entry point catches
 * this, prints `message` to stderr, and exits non-zero.
 */
export class CliInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliInputError';
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
 * @throws {CliInputError} If the value is not a valid item.
 */
function validateItem(value: unknown, index: number): Item {
  const where = `item at index ${index}`;
  if (!isPlainObject(value)) {
    throw new CliInputError(`Invalid ${where}: expected an object.`);
  }

  const { id, priority, tokens } = value;

  if (typeof id !== 'string') {
    throw new CliInputError(`Invalid ${where}: "id" must be a string.`);
  }
  if (typeof priority !== 'number' || !Number.isFinite(priority)) {
    throw new CliInputError(
      `Invalid ${where} (id "${id}"): "priority" must be a finite number.`,
    );
  }
  if (
    typeof tokens !== 'number' ||
    !Number.isInteger(tokens) ||
    tokens < 0
  ) {
    throw new CliInputError(
      `Invalid ${where} (id "${id}"): "tokens" must be a non-negative integer.`,
    );
  }

  return { id, priority, tokens };
}

/**
 * Parse a raw JSON string into a validated `Item[]`.
 *
 * @param raw The file contents.
 * @param source A label (e.g. the file path) used in error messages.
 * @throws {CliInputError} If the string is not valid JSON, is not an array, or
 *   any element does not match the item shape.
 */
export function parseItems(raw: string, source: string): Item[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new CliInputError(`Invalid JSON in ${source}: ${detail}`);
  }

  if (!Array.isArray(data)) {
    throw new CliInputError(
      `Invalid items in ${source}: expected a JSON array of items.`,
    );
  }

  return data.map((value, index) => validateItem(value, index));
}

/**
 * Read and validate an items JSON file into an `Item[]`.
 *
 * @param path Path to the JSON file.
 * @throws {CliInputError} If the file cannot be read, is not valid JSON, or does
 *   not match the expected item shape.
 */
export function loadItemsFile(path: string): Item[] {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new CliInputError(`Cannot read file "${path}": ${detail}`);
  }
  return parseItems(raw, path);
}

/**
 * Parse and validate a `--budget` value: it must be a non-negative integer.
 *
 * @param value The raw budget string (e.g. from `--budget 8000`), or `undefined`
 *   when the flag is missing.
 * @throws {CliInputError} If the value is missing, not an integer, or negative.
 */
export function parseBudget(value: string | undefined): number {
  if (value === undefined) {
    throw new CliInputError('Missing required option: --budget <n>.');
  }

  const trimmed = value.trim();
  // Accept only a plain non-negative integer literal (no decimals, signs,
  // exponents, hex, or whitespace-only strings). Number() is too permissive.
  if (!/^\d+$/.test(trimmed)) {
    throw new CliInputError(
      `Invalid --budget "${value}": must be a non-negative integer.`,
    );
  }

  const budget = Number(trimmed);
  if (!Number.isSafeInteger(budget)) {
    throw new CliInputError(
      `Invalid --budget "${value}": value is too large.`,
    );
  }
  return budget;
}
