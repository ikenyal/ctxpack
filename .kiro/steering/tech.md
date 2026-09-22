# Tech

## Stack

- **Language**: TypeScript (strict mode required)
- **Runtime**: Node 20+
- **Web UI**: Vite
- **Tests**: Vitest

## Constraints

- No backend, no database, no network calls. Everything runs locally and self-contained.
- The core packing function must be a **pure function** (same output for the same input, no side effects, no I/O). Located in `src/core/`.
- The CLI and Web UI are thin adapter layers; selection logic must always be delegated to the core.

## Language

- All files in this repository must be written in English: steering, specs, code, comments, and the README.

## Commands

- Test: `vitest --run`
- Web UI dev server: `vite` (started manually by the user)
- Build: `tsc` / `vite build`
