// ctxpack Web UI rendering.
// Pure view helpers that turn core `Item`s into DOM nodes. No packing logic
// lives here: this layer only displays items. Selection (task 9) delegates to
// the core. Depends on `src/core/` for types; the core never imports web.

import type { Item } from '../core/index.js';

/**
 * Render the given items into `container` as a list, showing each item's `id`,
 * `priority`, and `tokens`.
 *
 * The container is cleared first, so the function is safe to call repeatedly.
 * Items are rendered in the order provided; ordering/selection is a core
 * concern and is not decided here.
 *
 * @param container The element to render into (its contents are replaced).
 * @param items The items to display.
 */
export function renderItemList(container: HTMLElement, items: Item[]): void {
  container.replaceChildren();

  const list = document.createElement('ul');
  list.className = 'item-list';

  for (const item of items) {
    const row = document.createElement('li');
    row.className = 'item';
    row.dataset.id = item.id;

    const id = document.createElement('span');
    id.className = 'item-id';
    id.textContent = item.id;

    const priority = document.createElement('span');
    priority.className = 'item-priority';
    priority.textContent = String(item.priority);

    const tokens = document.createElement('span');
    tokens.className = 'item-tokens';
    tokens.textContent = String(item.tokens);

    row.append(id, priority, tokens);
    list.append(row);
  }

  container.append(list);
}
