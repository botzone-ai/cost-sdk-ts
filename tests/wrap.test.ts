import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrap, flush } from "../src";

const fakeFetch = vi.fn(async () => new Response("{}", { status: 202 }));

beforeEach(() => {
  fakeFetch.mockClear();
  process.env.COST_API_KEY = "cost_sk_test";
  process.env.COST_ENDPOINT = "http://localhost:3001";
});

describe("Anthropic wrapper", () => {
  it("intercepts messages.create, captures usage, forwards result", async () => {
    const fakeAnthropic = {
      messages: {
        create: vi.fn(async () => ({
          model: "claude-sonnet-4-6",
          usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 80 },
          content: [{ type: "text", text: "hi" }],
        })),
      },
    };
    const wrapped = wrap(fakeAnthropic, { route: "test", fetchImpl: fakeFetch });
    const result = await wrapped.messages.create({ model: "claude-sonnet-4-6", messages: [] });
    expect((result as { content: unknown }).content).toBeDefined();
    await flush();
    expect(fakeFetch).toHaveBeenCalled();
    const body = JSON.parse((fakeFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.events[0].provider).toBe("anthropic");
    expect(body.events[0].promptTokens).toBe(100);
    expect(body.events[0].cachedTokens).toBe(80);
    expect(body.events[0].route).toBe("test");
  });
});

describe("OpenAI wrapper", () => {
  it("intercepts chat.completions.create, captures usage", async () => {
    const fakeOpenAI = {
      chat: {
        completions: {
          create: vi.fn(async () => ({
            model: "gpt-4o-mini",
            usage: {
              prompt_tokens: 200,
              completion_tokens: 75,
              prompt_tokens_details: { cached_tokens: 50 },
            },
            choices: [{ message: { content: "hi" } }],
          })),
        },
      },
    };
    const wrapped = wrap(fakeOpenAI, { route: "summarise", fetchImpl: fakeFetch });
    await wrapped.chat.completions.create({ model: "gpt-4o-mini", messages: [] });
    await flush();
    const body = JSON.parse((fakeFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.events[0].provider).toBe("openai");
    expect(body.events[0].promptTokens).toBe(200);
    expect(body.events[0].cachedTokens).toBe(50);
  });
});

describe("Gemini wrapper", () => {
  it("intercepts generateContent on returned model, captures usage", async () => {
    const fakeGemini = {
      getGenerativeModel: vi.fn(({ model }: { model: string }) => ({
        model,
        generateContent: vi.fn(async () => ({
          response: {
            usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 100, cachedContentTokenCount: 0 },
            text: () => "hi",
          },
        })),
      })),
    };
    const wrapped = wrap(fakeGemini, { route: "classify", fetchImpl: fakeFetch });
    const model = wrapped.getGenerativeModel({ model: "gemini-2.5-flash" });
    await model.generateContent("hello");
    await flush();
    const body = JSON.parse((fakeFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.events[0].provider).toBe("gemini");
    expect(body.events[0].model).toBe("gemini-2.5-flash");
    expect(body.events[0].promptTokens).toBe(300);
  });
});

describe("disabled mode", () => {
  it("passes through without sending events when enabled=false", async () => {
    const fakeAnthropic = {
      messages: {
        create: vi.fn(async () => ({ model: "claude-haiku-4-5", usage: {}, content: [] })),
      },
    };
    const wrapped = wrap(fakeAnthropic, { enabled: false, fetchImpl: fakeFetch });
    await wrapped.messages.create({ model: "claude-haiku-4-5", messages: [] });
    await flush();
    expect(fakeFetch).not.toHaveBeenCalled();
  });
});

describe("captureBodies default", () => {
  it("does NOT send rawRequest or rawResponse when captureBodies is unset", async () => {
    const fakeAnthropic = {
      messages: {
        create: vi.fn(async () => ({
          model: "claude-sonnet-4-6",
          usage: { input_tokens: 10, output_tokens: 5 },
          content: [{ type: "text", text: "ok" }],
        })),
      },
    };
    const wrapped = wrap(fakeAnthropic, { route: "metadata-only", fetchImpl: fakeFetch });
    await wrapped.messages.create({ model: "claude-sonnet-4-6", messages: [{ role: "user", content: "secret" }] });
    await flush();
    const body = JSON.parse((fakeFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.events[0].rawRequest).toBeUndefined();
    expect(body.events[0].rawResponse).toBeUndefined();
    expect(body.events[0].promptHash).toBeDefined();
    expect(body.events[0].responseHash).toBeDefined();
  });

  it("DOES send rawRequest and rawResponse when captureBodies: true is explicit", async () => {
    const fakeAnthropic = {
      messages: {
        create: vi.fn(async () => ({
          model: "claude-sonnet-4-6",
          usage: { input_tokens: 10, output_tokens: 5 },
          content: [{ type: "text", text: "ok" }],
        })),
      },
    };
    const wrapped = wrap(fakeAnthropic, { route: "verify", captureBodies: true, fetchImpl: fakeFetch });
    await wrapped.messages.create({ model: "claude-sonnet-4-6", messages: [{ role: "user", content: "hello" }] });
    await flush();
    const body = JSON.parse((fakeFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.events[0].rawRequest).toBeDefined();
    expect(body.events[0].rawResponse).toBeDefined();
  });
});

describe("hot-path latency", () => {
  it("adds <5ms wall-clock per call vs the unwrapped client", async () => {
    const fakeAnthropic = {
      messages: {
        create: vi.fn(async () => ({ model: "claude-haiku-4-5", usage: {}, content: [] })),
      },
    };
    const baseline = await measure(async () => {
      for (let i = 0; i < 50; i++) {
        await fakeAnthropic.messages.create();
      }
    });
    const fakeAnthropic2 = {
      messages: {
        create: vi.fn(async () => ({ model: "claude-haiku-4-5", usage: {}, content: [] })),
      },
    };
    const wrapped = wrap(fakeAnthropic2, { fetchImpl: fakeFetch });
    const wrappedTime = await measure(async () => {
      for (let i = 0; i < 50; i++) {
        await wrapped.messages.create({ model: "claude-haiku-4-5", messages: [] });
      }
    });
    const overhead = (wrappedTime - baseline) / 50;
    expect(overhead).toBeLessThan(5);
  });
});

async function measure(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}
