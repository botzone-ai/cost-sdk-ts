// Run: COST_API_KEY=cost_sk_... GEMINI_API_KEY=AI... npx tsx examples/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { wrap } from "@botzone/cost-sdk";

const genAI = wrap(new GoogleGenerativeAI(process.env.GEMINI_API_KEY!), {
  route: "demo:translate",
  featureTag: "examples",
});

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const result = await model.generateContent(
  "Translate to French, then back to English: 'The early bird catches the worm.'",
);

console.log(result.response.text());
