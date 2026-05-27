import type { CapturedEvent } from "./types.js";

interface Config {
  apiKey: string;
  endpoint: string;
  fetchImpl: typeof fetch;
  maxQueueSize: number;
  flushIntervalMs: number;
  flushBatchSize: number;
  maxRetries: number;
  /** Called the first time an event is dropped due to a full queue.
   *  Default behaviour console.warn's once; pass a no-op to silence. */
  onFirstDrop?: (info: { maxQueueSize: number }) => void;
}

const DEFAULTS: Omit<
  Config,
  "apiKey" | "endpoint" | "fetchImpl" | "onFirstDrop"
> = {
  maxQueueSize: 1000,
  flushIntervalMs: 2000,
  flushBatchSize: 50,
  maxRetries: 3,
};

function defaultOnFirstDrop({ maxQueueSize }: { maxQueueSize: number }): void {
  // One-time warning so users notice without polling droppedCount().
  // Pattern matches what most SDKs do when their bounded buffer overflows.
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(
      `[@botzone/cost-sdk] ingestion queue full (max ${maxQueueSize}); events are being dropped. ` +
        "Check network connectivity to cost.botzone.ai, or raise maxQueueSize. " +
        "This warning fires once per process; use queue.droppedCount() for the running total.",
    );
  }
}

export class IngestionQueue {
  private queue: CapturedEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private dropped = 0;
  private cfg: Config;

  constructor(opts: {
    apiKey: string;
    endpoint: string;
    fetchImpl?: typeof fetch;
    onFirstDrop?: (info: { maxQueueSize: number }) => void;
  }) {
    this.cfg = {
      ...DEFAULTS,
      apiKey: opts.apiKey,
      endpoint: opts.endpoint.replace(/\/$/, ""),
      fetchImpl: opts.fetchImpl ?? globalThis.fetch.bind(globalThis),
      onFirstDrop: opts.onFirstDrop ?? defaultOnFirstDrop,
    };
    this.start();
  }

  enqueue(ev: CapturedEvent): void {
    if (this.queue.length >= this.cfg.maxQueueSize) {
      const wasFirst = this.dropped === 0;
      this.dropped++;
      if (wasFirst) {
        try {
          this.cfg.onFirstDrop?.({ maxQueueSize: this.cfg.maxQueueSize });
        } catch {
          /* host-installed callback threw - swallow */
        }
      }
      return;
    }
    this.queue.push(ev);
  }

  droppedCount(): number {
    return this.dropped;
  }

  pending(): number {
    return this.queue.length;
  }

  async flush(): Promise<void> {
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.cfg.flushBatchSize);
      await this.send(batch);
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private start(): void {
    if (this.timer) return;
    if (typeof setInterval === "undefined") return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.cfg.flushIntervalMs);
    if (typeof (this.timer as { unref?: () => void }).unref === "function") {
      (this.timer as { unref: () => void }).unref();
    }
  }

  private async tick(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.cfg.flushBatchSize);
    await this.send(batch);
  }

  private async send(batch: CapturedEvent[], attempt = 0): Promise<void> {
    try {
      const res = await this.cfg.fetchImpl(`${this.cfg.endpoint}/api/v1/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.cfg.apiKey,
        },
        body: JSON.stringify({ events: batch.map(toWire) }),
      });
      if (!res.ok && res.status >= 500 && attempt < this.cfg.maxRetries) {
        await sleep(2 ** attempt * 200);
        return this.send(batch, attempt + 1);
      }
    } catch {
      if (attempt < this.cfg.maxRetries) {
        await sleep(2 ** attempt * 200);
        return this.send(batch, attempt + 1);
      }
      // give up: events are dropped silently rather than crashing the host process
    }
  }
}

function toWire(ev: CapturedEvent) {
  return {
    provider: ev.provider,
    model: ev.model,
    promptTokens: ev.promptTokens,
    completionTokens: ev.completionTokens,
    cachedTokens: ev.cachedTokens,
    cacheCreationTokens: ev.cacheCreationTokens,
    latencyMs: ev.latencyMs,
    route: ev.route,
    userIdHash: ev.userIdHash,
    featureTag: ev.featureTag,
    promptHash: ev.promptHash,
    responseHash: ev.responseHash,
    rawRequest: ev.rawRequest,
    rawResponse: ev.rawResponse,
    occurredAt: ev.occurredAt,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
