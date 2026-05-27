// Run: COST_API_KEY=cost_sk_... OPENAI_API_KEY=sk-... npx tsx examples/openai.ts
import OpenAI from "openai";
import { wrap } from "@botzone/cost-sdk";

const openai = wrap(new OpenAI(), {
  route: "demo:classify",
  featureTag: "examples",
});

const reply = await openai.chat.completions.create({
  model: "gpt-4.1-mini",
  max_tokens: 64,
  messages: [
    { role: "system", content: "Classify the user input as positive, negative, or neutral. Reply with one word." },
    { role: "user", content: "I love how fast this dashboard renders." },
  ],
});

console.log(reply.choices[0].message.content);
