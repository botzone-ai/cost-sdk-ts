export type Provider = "anthropic" | "openai" | "gemini";

export interface WrapOptions {
  /** API key issued by the Cost dashboard. Required unless `enabled` is false. */
  apiKey?: string;
  /** Ingestion endpoint base URL. Defaults to https://cost.botzone.ai. */
  endpoint?: string;
  /** Logical route name (e.g. "follow-up-draft"). Strongly recommended. */
  route?: string;
  /** End-user identifier: will be sha256-hashed before send. */
  userId?: string;
  /** Free-form feature label for slicing in the dashboard. */
  featureTag?: string;
  /** Master switch. When false, the wrapper passes calls straight through. */
  enabled?: boolean;
  /** Capture full prompt + response bodies (default false). Set true per-route to enable
   *  verify-downgrade replay against the cheaper model. Off by default so the SDK ships
   *  metadata only unless you explicitly opt in. */
  captureBodies?: boolean;
  /** Override fetch (for tests). */
  fetchImpl?: typeof fetch;
  /** Override the auto-detected provider. */
  provider?: Provider;
}

export interface CapturedEvent {
  provider: Provider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  cacheCreationTokens: number;
  latencyMs: number;
  route?: string;
  userIdHash?: string;
  featureTag?: string;
  promptHash?: string;
  responseHash?: string;
  rawRequest?: unknown;
  rawResponse?: unknown;
  occurredAt: string;
}
