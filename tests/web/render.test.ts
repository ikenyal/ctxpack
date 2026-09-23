// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import type { Item } from '../../src/core/index.js';
import { renderItemList } from '../../src/web/render.js';

describe('renderItemList', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.replaceChildren(container);
  });

  const items: Item[] = [
    { id: 'a', priority: 30, tokens: 10 },
    { id: 'b', priority: 20, tokens: 25 },
    { id: 'c', priority: 10, tokens: 5 },
  ];

  it('displays all items with their id, priority, and tokens (Requirement 4.1)', () => {
    renderItemList(container, items);

    const rows = container.querySelectorAll('.item');
    expect(rows).toHaveLength(items.length);

    for (const item of items) {
      const row = container.querySelector<HTMLElement>(
        `.item[data-id="${item.id}"]`,
      );
      expect(row).not.toBeNull();
      expect(row?.querySelector('.item-id')?.textContent).toBe(item.id);
      expect(row?.querySelector('.item-priority')?.textContent).toBe(
        String(item.priority),
      );
      expect(row?.querySelector('.item-tokens')?.textContent).toBe(
        String(item.tokens),
      );
    }
  });

  it('renders an empty list when there are no items', () => {
    renderItemList(container, []);
    expect(container.querySelectorAll('.item')).toHaveLength(0);
  });

  it('replaces previous content on re-render', () => {
    renderItemList(container, items);
    renderItemList(container, [{ id: 'z', priority: 1, tokens: 1 }]);

    const rows = container.querySelectorAll('.item');
    expect(rows).toHaveLength(1);
    expect(container.querySelector('.item[data-id="z"]')).not.toBeNull();
    expect(container.querySelector('.item[data-id="a"]')).toBeNull();
  });
});
