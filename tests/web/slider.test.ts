// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import type { Item } from '../../src/core/index.js';
import { pack } from '../../src/core/index.js';
import {
  renderApp,
  renderItemList,
  updateSelection,
  totalTokens,
} from '../../src/web/render.js';

// Items with distinct priorities so the packing order is easy to reason about.
// Sorted (priority desc): a(10) -> b(25) -> c(5) -> d(30).
const items: Item[] = [
  { id: 'a', priority: 40, tokens: 10 },
  { id: 'b', priority: 30, tokens: 25 },
  { id: 'c', priority: 20, tokens: 5 },
  { id: 'd', priority: 10, tokens: 30 },
];

const selectedIds = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll<HTMLElement>('.item.selected')).map(
    (row) => row.dataset.id ?? '',
  );

describe('totalTokens', () => {
  it('sums the tokens of all items', () => {
    expect(totalTokens(items)).toBe(70);
  });

  it('is 0 for an empty list', () => {
    expect(totalTokens([])).toBe(0);
  });
});

describe('renderApp', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.replaceChildren(container);
  });

  it('bounds the slider to [0, sum(all tokens)]', () => {
    const { slider } = renderApp(container, items);
    expect(slider.min).toBe('0');
    expect(slider.max).toBe(String(totalTokens(items))); // 70
  });

  it('selects every item at the full budget by default (Requirement 4.2)', () => {
    const { slider } = renderApp(container, items);
    expect(slider.value).toBe('70');
    expect(selectedIds(container).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('highlights exactly what the core selects for the initial budget', () => {
    const { list } = renderApp(container, items, 15);
    // pack(items, 15): a(10) fits -> b(25) does not -> stop. Only 'a'.
    const expected = pack(items, 15).selected.map((item) => item.id);
    expect(selectedIds(list)).toEqual(expected);
    expect(selectedIds(list)).toEqual(['a']);
  });

  it('updates the highlighted selection when the slider moves (Requirements 4.2, 4.3)', () => {
    const { slider, list } = renderApp(container, items, 0);
    expect(selectedIds(list)).toEqual([]);

    // Move the slider up; dispatch input to update without a reload.
    slider.value = '35';
    slider.dispatchEvent(new Event('input'));
    // pack(items, 35): a(10) + b(25) = 35 fits -> c(5) does not -> stop.
    expect(selectedIds(list).sort()).toEqual(['a', 'b']);
    expect(selectedIds(list)).toEqual(pack(items, 35).selected.map((i) => i.id));

    // Move it higher: now c fits too (a+b+c = 40), d(30) does not.
    slider.value = '40';
    slider.dispatchEvent(new Event('input'));
    expect(selectedIds(list).sort()).toEqual(['a', 'b', 'c']);
  });

  it('shows total selected tokens and the current budget (Requirement 4.4)', () => {
    const { slider, summary } = renderApp(container, items, 35);
    // a + b = 35 selected tokens at budget 35.
    expect(summary.textContent).toBe('Selected 35 / 35 tokens');

    slider.value = '12';
    slider.dispatchEvent(new Event('input'));
    // Only a(10) fits at budget 12.
    expect(summary.textContent).toBe('Selected 10 / 12 tokens');
  });

  it('clamps an initial budget above the total to the maximum', () => {
    const { slider } = renderApp(container, items, 9999);
    expect(slider.value).toBe('70');
  });

  it('clamps a negative initial budget to zero', () => {
    const { slider, list } = renderApp(container, items, -5);
    expect(slider.value).toBe('0');
    expect(selectedIds(list)).toEqual([]);
  });
});

describe('updateSelection', () => {
  let container: HTMLElement;
  let summary: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    summary = document.createElement('p');
    document.body.replaceChildren(container, summary);
  });

  it('delegates selection to the core and toggles the selected class', () => {
    renderItemList(container, items);

    updateSelection(container, items, 40, summary);
    expect(selectedIds(container).sort()).toEqual(['a', 'b', 'c']);

    // Lowering the budget removes items already highlighted (in place).
    updateSelection(container, items, 10, summary);
    expect(selectedIds(container)).toEqual(['a']);
    expect(summary.textContent).toBe('Selected 10 / 10 tokens');
  });
});
