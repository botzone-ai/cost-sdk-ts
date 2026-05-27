import { IngestionQueue } from "./queue.js";
import { isAnthropic, wrapAnthropic } from "./providers/anthropic.js";
import { isOpenAI, wrapOpenAI } from "./providers/openai.js";
import { isGemini, wrapGemini } from "./providers/gemini.js";
import type { WrapOptions, CapturedEvent } from "./types.js";

const queues = new Map<string, IngestionQueue>();

function getQueue(opts: WrapOptions): IngestionQueue | null {
  if (opts.enabled === false) return null;
  const apiKey = opts.apiKey ?? process.env.COST_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[cost-sdk] COST_API_KEY not set: events will be dropped");
    }
    return null;
  }
  const endpoint = opts.endpoint ?? process.env.COST_ENDPOINT ?? "https://cost.botzone.ai";
  const key = `${apiKey}:${endpoint}`;
  let q = queues.get(key);
  if (!q) {
    q = new IngestionQueue({ apiKey, endpoint, fetchImpl: opts.fetchImpl });
    queues.set(key, q);
  }
  return q;
}

/**
 * Wrap an Anthropic, OpenAI, or Gemini client to capture cost-tracking events.
 * Returns the same client (mutated) for ergonomic chaining.
 *
 * @example
 *   import Anthropic from "@anthropic-ai/sdk";
 *   import { wrap } from "@botzone/cost-sdk";
 *
 *   const anthropic = wrap(new Anthropic(), { route: "follow-up-draft" });
 */
export function wrap<T>(client: T, opts: WrapOptions = {}): T {
  const queue = getQueue(opts);
  const emit = (ev: CapturedEvent) => queue?.enqueue(ev);

  const provider = opts.provider ?? detectProvider(client);
  if (!provider) {
    throw new Error(
      "[cost-sdk] could not detect provider: pass { provider: 'anthropic' | 'openai' | 'gemini' }",
    );
  }
  switch (provider) {
    case "anthropic":
      return wrapAnthropic(client as never, opts, emit) as T;
    case "openai":
      return wrapOpenAI(client as never, opts, emit) as T;
    case "gemini":
      return wrapGemini(client as never, opts, emit) as T;
  }
}

function detectProvider(client: unknown) {
  if (isAnthropic(client)) return "anthropic" as const;
  if (isOpenAI(client)) return "openai" as const;
  if (isGemini(client)) return "gemini" as const;
  return null;
}

export async function flush(): Promise<void> {
  await Promise.all(Array.from(queues.values()).map((q) => q.flush()));
}
