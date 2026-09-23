// ctxpack Web UI entry point.
// Loads a list of items and renders them with a budget slider via the pure view
// in `render.ts`. Moving the slider re-runs the core packer and updates the
// highlighted selection in place. All selection logic delegates to `src/core/`;
// this layer holds none.

import type { Item } from '../core/index.js';
import { renderApp } from './render.js';
import './style.css';

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
  renderApp(app, items);
}
