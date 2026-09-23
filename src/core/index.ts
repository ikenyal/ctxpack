// ctxpack core: pure packing logic + token counter (no I/O).
// The CLI and Web UI depend on this module; this module depends on neither.
// Re-exports the Item and PackResult types plus the compareItems and pack functions from ./model.
export type { Item, PackResult } from './model.js';
export { compareItems, pack } from './model.js';
