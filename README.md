# @botzone/cost-sdk

Cost-tracking SDK for Anthropic, OpenAI, and Gemini clients. Wraps your existing
LLM client and ships per-call usage to your Cost dashboard. Adds zero
measurable latency to the host call.

## Install

```
npm install @botzone/cost-sdk
```

## Usage

```ts
import Anthropic from "@anthropic-ai/sdk";
import { wrap } from "@botzone/cost-sdk";

const anthropic = wrap(new Anthropic(), {
  apiKey: process.env.COST_API_KEY,
  route: "follow-up-draft",
  enabled: process.env.COST_ENABLED === "true",
});
```

`wrap` auto-detects the provider. Same surface for OpenAI and Gemini:

```ts
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const openai = wrap(new OpenAI(), { route: "summariser" });
const gemini = wrap(new GoogleGenerativeAI(key), { route: "classifier" });
```

## Options

| field          | meaning                                                     |
| -------------- | ----------------------------------------------------------- |
| `apiKey`       | Cost API key. Defaults to `process.env.COST_API_KEY`.       |
| `endpoint`     | Ingestion URL. Defaults to `https://cost.botzone.ai`.       |
| `route`        | Logical name shown in the dashboard (strongly recommended). |
| `userId`       | Optional end-user id: sha256-hashed before send.           |
| `featureTag`   | Free-form label for slicing.                                |
| `enabled`      | Master switch. `false` = passthrough.                       |
| `captureBodies`| Capture full prompt + response (default `false`). Set `true` per route to enable verify-downgrade replay. |

## What gets captured

**By default (metadata only):** token counts (including Anthropic prompt-cache
reads / writes and OpenAI cached prompt tokens), latency, model, route, user id
(hashed in the SDK before send), feature tag, SHA-256 hashes of prompt and
response. Computed USD cost is added server-side from the live pricing table.

**Opt-in (`captureBodies: true`):** the raw request and response JSON are sent
in addition to the metadata above. This is required for the verify-downgrade
feature, which replays a sample of your real traffic on a cheaper model. Set it
per-route so only the traffic you want evaluated has its bodies sent.

Cost stores raw bodies for 30 days on the free tier, 90 days on paid plans, then
purges them automatically. End-user identifiers you pass via `userId` are hashed
with SHA-256 in the SDK; the plaintext never leaves your process.
