// ctxpack Web UI rendering.
// Pure view helpers that turn core `Item`s into DOM nodes. No packing logic
// lives here: this layer only displays items. Selection (task 9) delegates to
// the core. Depends on `src/core/` for types; the core never imports web.

import type { Item } from '../core/index.js';
import { pack } from '../core/index.js';

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

  const header = document.createElement('div');
  header.className = 'item-header';

  const headerId = document.createElement('span');
  headerId.className = 'item-id';
  headerId.textContent = 'id';

  const headerPriority = document.createElement('span');
  headerPriority.className = 'item-priority';
  headerPriority.textContent = 'priority';

  const headerTokens = document.createElement('span');
  headerTokens.className = 'item-tokens';
  headerTokens.textContent = 'tokens';

  header.append(headerId, headerPriority, headerTokens);

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

  container.append(header, list);
}

/** Sum the `tokens` of every item; the upper bound for the budget slider. */
export function totalTokens(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.tokens, 0);
}

/**
 * Highlight the currently selected items and update the budget/total readout.
 *
 * Selection is delegated entirely to {@link pack} in the core — this layer
 * reimplements no packing logic (Requirement 4.5). Each item row gains or loses
 * the `selected` class based on whether the core included it.
 *
 * @param container The element previously populated by {@link renderItemList}.
 * @param items The full item list (same list that was rendered).
 * @param budget The current budget (from the slider).
 * @param summary The element that shows total selected tokens vs. the budget.
 */
export function updateSelection(
  container: HTMLElement,
  items: Item[],
  budget: number,
  summary: HTMLElement,
): void {
  const result = pack(items, budget);
  const selectedIds = new Set(result.selected.map((item) => item.id));

  const rows = container.querySelectorAll<HTMLElement>('.item');
  for (const row of rows) {
    const id = row.dataset.id ?? '';
    row.classList.toggle('selected', selectedIds.has(id));
  }

  summary.textContent = `Selected ${result.totalTokens} / ${budget} tokens`;
}

/** Elements produced by {@link renderApp}, exposed so callers can test them. */
export interface AppView {
  /** The budget slider input, bounded to `[0, sum(all tokens)]`. */
  slider: HTMLInputElement;
  /** The element showing selected total tokens vs. the current budget. */
  summary: HTMLElement;
  /** The container that holds the item rows. */
  list: HTMLElement;
}

/**
 * Render the full Web UI: an item list, a budget slider bounded to
 * `[0, sum(all tokens)]`, and a summary readout. Moving the slider re-runs the
 * core packer and updates the highlighted selection in place — no page reload
 * (Requirements 4.2, 4.3, 4.4).
 *
 * The UI holds no packing logic; it is a pure view over {@link pack}.
 *
 * @param container The root element to render into (its contents are replaced).
 * @param items The items to display and pack.
 * @param initialBudget Optional starting budget; defaults to the full total so
 *   every item is selected initially. Clamped to `[0, sum(all tokens)]`.
 * @returns The slider, summary, and list elements for further use or testing.
 */
export function renderApp(
  container: HTMLElement,
  items: Item[],
  initialBudget?: number,
): AppView {
  container.replaceChildren();

  const max = totalTokens(items);
  const budget =
    initialBudget === undefined ? max : Math.min(Math.max(initialBudget, 0), max);

  const heading = document.createElement('h1');
  heading.className = 'app-title';
  heading.textContent = 'ctxpack';

  const subtitle = document.createElement('p');
  subtitle.className = 'app-subtitle';
  subtitle.textContent =
    'Priority-prefix packing: stops at the first item that does not fit, so raising the budget never removes a selected item.';

  const controls = document.createElement('div');
  controls.className = 'controls';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'budget-slider';
  slider.min = '0';
  slider.max = String(max);
  slider.step = '1';
  slider.value = String(budget);

  const summary = document.createElement('p');
  summary.className = 'summary';

  controls.append(slider, summary);

  const list = document.createElement('div');
  list.className = 'list-container';
  renderItemList(list, items);

  container.append(heading, subtitle, controls, list);

  const applyBudget = (): void => {
    updateSelection(list, items, Number(slider.value), summary);
  };

  // Update highlights on every slider move without re-rendering the page.
  slider.addEventListener('input', applyBudget);
  applyBudget();

  return { slider, summary, list };
}
