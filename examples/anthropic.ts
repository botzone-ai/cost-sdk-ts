// Run: COST_API_KEY=cost_sk_... ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";
import { wrap } from "@botzone/cost-sdk";

const anthropic = wrap(new Anthropic(), {
  route: "demo:summarise",
  featureTag: "examples",
});

const reply = await anthropic.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 256,
  messages: [
    { role: "user", content: "Summarise the plot of Hamlet in two sentences." },
  ],
});

console.log(reply.content[0].type === "text" ? reply.content[0].text : reply);
