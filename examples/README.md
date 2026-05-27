# Examples

Paste-and-run snippets for each provider. Each script:
- imports the real provider SDK
- wraps it with `@botzone/cost-sdk`
- makes one LLM call
- prints the response

## Prerequisites

- A Cost API key from https://cost.botzone.ai (`cost_sk_...`)
- A provider API key (Anthropic / OpenAI / Gemini, depending on which script)
- `npm install` once at the repo root

## Run

```bash
COST_API_KEY=cost_sk_... ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/anthropic.ts
COST_API_KEY=cost_sk_... OPENAI_API_KEY=sk-...        npx tsx examples/openai.ts
COST_API_KEY=cost_sk_... GEMINI_API_KEY=AI...         npx tsx examples/gemini.ts
```

Within a few seconds the call should appear on your Cost dashboard under the `examples` feature tag.
