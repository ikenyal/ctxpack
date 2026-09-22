# Product

## ctxpack

A context packer for LLM agents. Given a list of items (each with an id, a priority, and a token count) and a token budget, it selects which items to include in the context.

## Why

Agents have limited context windows. Deciding what to include should be predictable, not ad hoc. ctxpack makes this selection deterministic and reproducible.

## Surfaces

- **Core library**: pure selection logic, no side effects. Lives in `src/core/`.
- **CLI**: `ctxpack pack items.json --budget 8000`
- **Web UI**: a small single-page app with a budget slider.

## Non-goals

- Exact tokenizer parity with any specific model
- File system crawling
- Filling leftover budget with lower-priority items
