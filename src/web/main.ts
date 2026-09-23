// ctxpack Web UI entry point.
// Loads a list of items and renders all of them via the pure view in
// `render.ts`. The budget slider and selection highlighting arrive in task 9.
// All selection logic delegates to `src/core/`; this layer holds none.

import type { Item } from '../core/index.js';
import { renderItemList } from './render.js';

/**
 * Sample items shown when the app loads. Local and self-contained (no network,
 * no file system); these stand in until item loading is wired up.
 */
const items: Item[] = [
  { id: 'system-prompt', priority: 100, tokens: 120 },
  { id: 'user-goal', priority: 90, tokens: 60 },
  { id: 'recent-turn', priority: 80, tokens: 200 },
  { id: 'code-context', priority: 70, tokens: 320 },
  { id: 'doc-snippet', priority: 40, tokens: 150 },
  { id: 'misc-note', priority: 10, tokens: 45 },
];

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  renderItemList(app, items);
}
