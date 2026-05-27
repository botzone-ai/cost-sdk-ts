import type { CapturedEvent, WrapOptions } from "../types.js";
import { sha256 } from "../hash.js";

interface AnthropicLike {
  messages: {
    create: (...args: unknown[]) => unknown;
  };
}

export function isAnthropic(client: unknown): client is AnthropicLike {
  return (
    typeof client === "object" &&
    client !== null &&
    "messages" in client &&
    typeof (client as { messages?: { create?: unknown } }).messages?.create === "function"
  );
}

export function wrapAnthropic(
  client: AnthropicLike,
  opts: WrapOptions,
  emit: (ev: CapturedEvent) => void,
): AnthropicLike {
  const originalCreate = client.messages.create.bind(client.messages);
  const captureBodies = opts.captureBodies === true;

  client.messages.create = (async (...args: unknown[]) => {
    const start = Date.now();
    const req = args[0] as Record<string, unknown> | undefined;
    try {
      const result = (await originalCreate(...args)) as Record<string, unknown>;
      const latency = Date.now() - start;
      const usage = (result?.usage as Record<string, number> | undefined) ?? {};
      const ev: CapturedEvent = {
        provider: "anthropic",
        model: (result?.model as string) ?? (req?.model as string) ?? "unknown",
        promptTokens: usage.input_tokens ?? 0,
        completionTokens: usage.output_tokens ?? 0,
        cachedTokens: usage.cache_read_input_tokens ?? 0,
        cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
        latencyMs: latency,
        route: opts.route,
        featureTag: opts.featureTag,
        userIdHash: opts.userId ? await sha256(opts.userId) : undefined,
        promptHash: req ? await sha256(JSON.stringify(req)) : undefined,
        responseHash: result ? await sha256(JSON.stringify(result)) : undefined,
        rawRequest: captureBodies ? req : undefined,
        rawResponse: captureBodies ? result : undefined,
        occurredAt: new Date().toISOString(),
      };
      emit(ev);
      return result;
    } catch (err) {
      // Forward errors verbatim: never swallow.
      throw err;
    }
  }) as AnthropicLike["messages"]["create"];

  return client;
}
