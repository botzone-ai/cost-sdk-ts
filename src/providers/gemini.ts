import type { CapturedEvent, WrapOptions } from "../types.js";
import { sha256 } from "../hash.js";

// GoogleGenerativeAI is a factory: `genAI.getGenerativeModel({ model })` returns
// a `GenerativeModel` whose `generateContent` is the actual call site. We wrap
// `getGenerativeModel` so every model instance it returns has its
// `generateContent` and `generateContentStream` instrumented.

interface GeminiModelLike {
  generateContent: (...args: unknown[]) => unknown;
  generateContentStream?: (...args: unknown[]) => unknown;
  model?: string;
}

interface GoogleGenAILike {
  getGenerativeModel: (params: { model: string } & Record<string, unknown>) => GeminiModelLike;
}

export function isGemini(client: unknown): client is GoogleGenAILike {
  return (
    typeof client === "object" &&
    client !== null &&
    "getGenerativeModel" in client &&
    typeof (client as { getGenerativeModel?: unknown }).getGenerativeModel === "function"
  );
}

export function wrapGemini(
  client: GoogleGenAILike,
  opts: WrapOptions,
  emit: (ev: CapturedEvent) => void,
): GoogleGenAILike {
  const originalGet = client.getGenerativeModel.bind(client);
  const captureBodies = opts.captureBodies === true;

  client.getGenerativeModel = (params) => {
    const model = originalGet(params);
    const modelName = params.model;
    const originalGen = model.generateContent.bind(model);

    model.generateContent = (async (...args: unknown[]) => {
      const start = Date.now();
      const req = args[0];
      const result = (await originalGen(...args)) as {
        response?: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number } };
      };
      const latency = Date.now() - start;
      const usage = result?.response?.usageMetadata ?? {};
      const ev: CapturedEvent = {
        provider: "gemini",
        model: modelName,
        promptTokens: usage.promptTokenCount ?? 0,
        completionTokens: usage.candidatesTokenCount ?? 0,
        cachedTokens: usage.cachedContentTokenCount ?? 0,
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
    }) as GeminiModelLike["generateContent"];

    return model;
  };

  return client;
}
