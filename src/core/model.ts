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

/**
 * Select the highest-priority prefix of `items` that fits within `budget`.
 *
 * Items are sorted with {@link compareItems} (priority desc, then id asc) and
 * added in order until one does not fit; packing then STOPS. This
 * priority-prefix rule (never skip-and-continue) is what guarantees budget
 * monotonicity: a larger budget can only ever add items, never swap them.
 *
 * Pure: the input array is not mutated and no I/O is performed.
 *
 * @param items The candidate items. `id`s must be unique.
 * @param budget The maximum total tokens allowed. A budget of `0` selects only
 *   a leading run of zero-token items.
 * @throws {Error} If any two items share the same `id`.
 */
export function pack(items: Item[], budget: number): PackResult {
  // Reject duplicate ids before sorting so the error is deterministic.
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      throw new Error(`Duplicate id: ${item.id}`);
    }
    ids.add(item.id);
  }

  const sorted = [...items].sort(compareItems);
  const selected: Item[] = [];
  let used = 0;
  for (const item of sorted) {
    if (used + item.tokens > budget) break; // stop at the first item that does not fit
    selected.push(item);
    used += item.tokens;
  }
  return { selected, totalTokens: used };
}
