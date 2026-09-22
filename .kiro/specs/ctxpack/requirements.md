# Requirements

## Introduction

ctxpack is a context packer for LLM agents. Given a list of items (each with an
`id`, a `priority`, and a `tokens` count) and a token budget, it deterministically
selects which items to include in the context using priority-prefix packing.

This document specifies the requirements for three surfaces:

- **Core library** — pure selection logic in `src/core/`.
- **CLI** — `ctxpack pack items.json --budget 8000`.
- **Web UI** — a single-page app with a budget slider.

Requirements are written in EARS (Easy Approach to Requirements Syntax) notation.

### Glossary

- **Item**: an object with `id` (string), `priority` (number), and `tokens`
  (non-negative integer).
- **Budget**: a non-negative integer token limit.
- **Selected set**: the subset of items chosen by the packer for a given budget.
- **Priority-prefix packing**: sort deterministically, then walk the sorted list
  and stop at the first item that does not fit (see `packing-semantics.md`).

## Requirements

### Requirement 1: Priority-prefix packing within a token budget

**User Story:** As an agent developer, I want the packer to select items within a
token budget using priority-prefix semantics, so that the selection is predictable
and never wastes the budget on lower-priority items ahead of higher-priority ones.

#### Acceptance Criteria

1. WHEN the packer is given a list of items and a budget THEN the packer SHALL
   sort the items by `priority` descending, then by `id` ascending as a
   tie-breaker.
2. WHEN walking the sorted list THEN the packer SHALL add each item whose `tokens`
   fit within the remaining budget to the selected set.
3. WHEN the packer reaches the first item whose `tokens` do not fit within the
   remaining budget THEN the packer SHALL stop and SHALL NOT consider any later
   items (priority-prefix, no skip-and-continue).
4. WHEN the budget is `0` THEN the packer SHALL return an empty selected set,
   unless an item has `tokens` equal to `0`, in which case such items at the front
   of the sorted prefix SHALL be selected.
5. WHEN the item list is empty THEN the packer SHALL return an empty selected set.

### Requirement 2: Deterministic output regardless of input order

**User Story:** As an agent developer, I want the same set of items to produce the
same selection no matter what order they arrive in, so that results are
reproducible.

#### Acceptance Criteria

1. WHEN the packer is given two input lists that are permutations of each other
   with the same budget THEN the packer SHALL produce the same selected set.
2. WHEN the packer produces a result THEN the packer SHALL order the selected set
   deterministically (by `priority` descending, then `id` ascending).
3. WHEN two items have equal `priority` THEN the packer SHALL break the tie by `id`
   ascending.
4. IF two or more items share the same `id` THEN the packer SHALL throw an error.

### Requirement 3: CLI packing from a JSON file

**User Story:** As a command-line user, I want to pack items from a JSON file under
a budget and see the result, so that I can integrate ctxpack into scripts.

#### Acceptance Criteria

1. WHEN the user runs `ctxpack pack <file> --budget <n>` THEN the CLI SHALL read
   the JSON file, parse it as a list of items, and delegate selection to the core.
2. WHEN the core returns a result THEN the CLI SHALL print the selected item `id`s
   and the total tokens of the selected set.
3. IF the file does not exist or cannot be read THEN the CLI SHALL print an error
   message and exit with a non-zero status code.
4. IF the file content is not valid JSON or does not match the expected item shape
   THEN the CLI SHALL print a descriptive validation error and exit with a
   non-zero status code.
5. IF `--budget` is missing, negative, or not an integer THEN the CLI SHALL print
   an error message and exit with a non-zero status code.

### Requirement 4: Web UI with a budget slider

**User Story:** As a user, I want to see all items and watch which ones are selected
as I move a budget slider, so that I can understand the packing behavior visually.

#### Acceptance Criteria

1. WHEN the web UI loads a list of items THEN the UI SHALL display all items with
   their `id`, `priority`, and `tokens`.
2. WHEN the user moves the budget slider THEN the UI SHALL delegate selection to the
   core and SHALL highlight the currently selected items.
3. WHEN the slider value changes THEN the UI SHALL update the highlighted selection
   without requiring a page reload.
4. WHEN items are highlighted THEN the UI SHALL also display the total tokens of the
   selected set and the current budget.
5. WHERE selection logic is required THEN the UI SHALL delegate it to the core and
   SHALL NOT reimplement packing logic.

### Requirement 5: Pluggable token counter with a documented default

**User Story:** As an agent developer, I want a pluggable token counter that defaults
to a simple approximation, so that I can swap in a real tokenizer later without
changing the core.

#### Acceptance Criteria

1. WHERE a token count is needed for text THEN the system SHALL obtain it through a
   pluggable token counter interface.
2. WHEN no token counter is supplied THEN the system SHALL use a default counter
   that approximates token count as `Math.ceil(text.length / 4)`.
3. WHEN the default counter is documented THEN the documentation SHALL clearly state
   that it is an approximation and does not match any real model tokenizer.
4. WHEN a caller supplies a custom token counter THEN the system SHALL use it in
   place of the default.
