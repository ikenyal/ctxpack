# Implementation Plan

- [x] 1. Scaffold the project
  - Create `package.json` (Node 20+, type: module, scripts for test/build/lint/dev).
  - Create `tsconfig.json` in strict mode.
  - Add and configure Vitest, ESLint, and Vite.
  - Create empty `src/core/`, `src/cli/`, `src/web/`, and `tests/` directories with
    placeholder entry files.
  - Confirm `vitest --run` executes (zero tests is fine) and `tsc --noEmit` passes.
  - _Requirements: all (project setup)_

- [x] 2. Define the core data model and comparator
  - Add `Item` and `PackResult` types in `src/core/`.
  - Implement `compareItems` (priority descending, then `id` ascending).
  - Add unit tests for the comparator, including the equal-priority tie-break.
  - _Requirements: 1.1, 2.2, 2.3_

- [x] 3. Implement the core packing function
  - Implement `pack(items, budget)` using priority-prefix semantics (stop at the
    first item that does not fit; never skip-and-continue).
  - Reject duplicate `id`s: check for duplicates before sorting and throw an error.
  - Add unit tests: normal packing, stop-at-first-overflow, empty list, zero budget,
    zero-token items, and a duplicate-id error test.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.4_

- [x] 4. Add property-based tests for the correctness properties
  - Add a property-based testing library. Generate `Item[]` with unique `id`s,
    integer priorities (no `NaN` or `Infinity`, since `compareItems` relies on
    numeric subtraction), and non-negative integers for `tokens` and `budget`.
    Write tests for:
    - Property 1 — Budget: selected tokens never exceed the budget.
    - Property 2 — No priority inversion.
    - Property 3 — Budget monotonicity (subset for `b1 <= b2`).
    - Property 4 — Order independence (shuffled input yields the same result).
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4_

- [x] 5. Implement the pluggable token counter
  - Define the `TokenCounter` interface and the `approxTokenCounter` default
    (`Math.ceil(text.length / 4)`) in `src/core/`.
  - Document clearly that the default is an approximation and matches no real
    tokenizer.
  - Add unit tests for the default counter and for supplying a custom counter.
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. Implement CLI item loading and validation
  - In `src/cli/`, read the JSON file and validate it parses into `Item[]`.
  - Parse and validate `--budget` (non-negative integer).
  - Report descriptive errors to stderr and exit non-zero on failure.
  - Add tests for valid input, missing/unreadable file, invalid JSON, bad item
    shape, and invalid budget.
  - _Requirements: 3.1, 3.3, 3.4, 3.5_

- [ ] 7. Wire the CLI to the core and format output
  - Call `core.pack` and print the selected `id`s and total tokens.
  - Add tests asserting the printed ids and total tokens for known inputs.
  - _Requirements: 3.1, 3.2_

- [ ] 8. Build the Web UI item list
  - In `src/web/`, create the Vite SPA that renders all items with `id`, `priority`,
    and `tokens`.
  - Add a test that all items are displayed.
  - _Requirements: 4.1, 4.5_

- [ ] 9. Add the budget slider and selection highlighting
  - Add a budget slider bounded to `[0, sum(all tokens)]`.
  - On slider change, call `core.pack`, highlight selected items, and show total
    tokens vs. budget without a page reload.
  - Add tests that moving the slider updates the highlighted selection via the core.
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [ ] 10. Add a README and finalize
  - Document install, `vitest --run`, `vite`, and the CLI usage
    (`ctxpack pack items.json --budget 8000`).
  - Note that the default token counter is an approximation.
  - Ensure lint, type-check, and all tests pass.
  - _Requirements: 5.3_
