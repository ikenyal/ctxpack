// ctxpack core: pure packing logic + token counter (no I/O).
// The CLI and Web UI depend on this module; this module depends on neither.
// Packing logic is implemented in later tasks.
export type { Item, PackResult } from './model.js';
export { compareItems, pack } from './model.js';
