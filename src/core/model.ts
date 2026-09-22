// ctxpack core data model.
// Pure types + the deterministic comparator. No I/O; never imports cli or web.

/** A packable unit of context. */
export interface Item {
  /** Unique identifier. Uniqueness is enforced by `pack` (throws on duplicates). */
  id: string;
  /** Importance; higher means more important. */
  priority: number;
  /** Non-negative integer token count. */
  tokens: number;
}

/** The outcome of packing a set of items under a budget. */
export interface PackResult {
  /** Selected items in deterministic order (priority desc, then id asc). */
  selected: Item[];
  /** Sum of `tokens` across the selected items. */
  totalTokens: number;
}

/**
 * Deterministic total-order comparator: `priority` descending, then `id`
 * ascending as a tie-breaker. Given unique `id`s this induces a strict total
 * order, which is what makes packing independent of input order.
 *
 * @returns negative if `a` sorts before `b`, positive if after, `0` if equal.
 */
export function compareItems(a: Item, b: Item): number {
  if (a.priority !== b.priority) return b.priority - a.priority; // priority desc
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; // id asc
}
