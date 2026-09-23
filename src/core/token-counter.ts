// ctxpack pluggable token counter.
// Pure: converts text to a token estimate. No I/O; never imports cli or web.

/**
 * Converts a piece of text into a token count.
 *
 * This is the seam that lets callers plug in their own estimation strategy
 * (for example a model-specific tokenizer) instead of the built-in default.
 * `pack` itself operates on precomputed `tokens`, so a counter is only needed
 * where raw text is turned into an {@link Item.tokens} value.
 */
export interface TokenCounter {
  count(text: string): number;
}

/**
 * Default approximation. NOT a real tokenizer: it does not match GPT, Claude,
 * or any specific model's tokenizer. It simply estimates roughly four
 * characters per token via `Math.ceil(text.length / 4)`.
 *
 * Use it for a rough, dependency-free estimate. When accuracy matters, supply
 * a custom {@link TokenCounter} instead.
 */
export const approxTokenCounter: TokenCounter = {
  count: (text) => Math.ceil(text.length / 4),
};
