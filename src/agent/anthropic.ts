import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only Anthropic client, lazily constructed (same pattern as the Stripe
 * client). Importing a route that uses this at build time must not require the
 * key to be present; it is only needed when the agent actually runs.
 */
let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  client = new Anthropic({ apiKey });
  return client;
}

/** Latest, most capable Claude model — used for invoice extraction and the agent. */
export const AGENT_MODEL = "claude-opus-4-8";

/**
 * Thin wrapper around `messages.create`. The request body intentionally carries
 * fields newer than the pinned SDK's types (adaptive thinking, `output_config`
 * with `effort`), so we cast the params at this single boundary rather than
 * coupling every call site to the SDK's type version. The response is the
 * normal typed `Anthropic.Message`.
 */
export async function createMessage(
  body: Record<string, unknown>,
): Promise<Anthropic.Message> {
  const params = body as unknown as Anthropic.MessageCreateParamsNonStreaming;
  return getAnthropic().messages.create(params) as Promise<Anthropic.Message>;
}

/** Concatenate the text blocks of a message into a single string. */
export function messageText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
