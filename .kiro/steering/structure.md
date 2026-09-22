# Structure

```
ctxpack/
├── src/
│   ├── core/        # Pure packing logic (no side effects, no I/O)
│   ├── cli/         # CLI adapter (arg parsing, file reading -> calls core)
│   └── web/         # Vite-based single-page UI
├── tests/           # Vitest tests
└── .kiro/steering/  # Steering files
```

## Rules

- **`src/core/`**: the heart of packing. Pure functions only. No dependency on CLI or Web. Other layers depend on this.
- **`src/cli/`**: reads `items.json` and parses `--budget`, then delegates selection to the core.
- **`src/web/`**: UI such as the budget slider. Holds no logic; calls the core.
- Dependencies always point inward: cli / web -> core. The core must never import from the outer layers.
- Each item has an `id`, a `priority`, and a token count.
