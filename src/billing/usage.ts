import type Anthropic from "@anthropic-ai/sdk";

/**
 * Accumulates real Claude token usage across the multiple model calls a single
 * agent run makes (extraction + each tool-loop turn). Cache tokens count as
 * input. The route reads `totalTokens` and records it against the subscriber's
 * usage period.
 */
export class UsageMeter {
  inputTokens = 0;
  outputTokens = 0;

  addFromMessage(message: Anthropic.Message): void {
    const u = message.usage;
    this.inputTokens +=
      u.input_tokens +
      (u.cache_creation_input_tokens ?? 0) +
      (u.cache_read_input_tokens ?? 0);
    this.outputTokens += u.output_tokens;
  }

  get totalTokens(): number {
    return this.inputTokens + this.outputTokens;
  }
}
