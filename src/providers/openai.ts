import type { CapturedEvent, WrapOptions } from "../types.js";
import { sha256 } from "../hash.js";

interface OpenAILike {
  chat: {
    completions: {
      create: (...args: unknown[]) => unknown;
    };
  };
}

export function isOpenAI(client: unknown): client is OpenAILike {
  return (
    typeof client === "object" &&
    client !== null &&
    "chat" in client &&
    typeof (client as { chat?: { completions?: { create?: unknown } } }).chat?.completions
      ?.create === "function"
  );
}

export function wrapOpenAI(
  client: OpenAILike,
  opts: WrapOptions,
  emit: (ev: CapturedEvent) => void,
): OpenAILike {
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);
  const captureBodies = opts.captureBodies === true;

  client.chat.completions.create = (async (...args: unknown[]) => {
    const start = Date.now();
    const req = args[0] as Record<string, unknown> | undefined;
    const result = (await originalCreate(...args)) as Record<string, unknown>;
    const latency = Date.now() - start;
    const usage = (result?.usage as Record<string, number | Record<string, number>> | undefined) ?? {};
    const promptDetails = (usage.prompt_tokens_details as Record<string, number> | undefined) ?? {};
    const ev: CapturedEvent = {
      provider: "openai",
      model: (result?.model as string) ?? (req?.model as string) ?? "unknown",
      promptTokens: (usage.prompt_tokens as number) ?? 0,
      completionTokens: (usage.completion_tokens as number) ?? 0,
      cachedTokens: promptDetails.cached_tokens ?? 0,
      cacheCreationTokens: 0,
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
  }) as OpenAILike["chat"]["completions"]["create"];

  return client;
}
