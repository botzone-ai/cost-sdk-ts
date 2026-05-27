# Contributing

Thanks for taking an interest. This is the TypeScript SDK for Cost, an LLM cost attribution tool. The dashboard, recommendation engine, and verification system live in a separate (closed) codebase.

## What's in scope for contributions

- Bug fixes in the wrappers (Anthropic, OpenAI, Gemini)
- Performance improvements
- Additional provider support
- Test coverage
- Documentation improvements

## What's out of scope

- Anything that sends additional data to the Cost backend beyond the documented metadata
- Anything that changes the public API without prior discussion
- Vendor-specific business logic

## Development setup

- Node 18+
- `npm install`
- `npm run build` compiles to `dist/`
- `npm test` runs the vitest suite

## Pull requests

Small, focused, with tests. Open an issue first for anything non-trivial.

## Code of conduct

Be respectful. Don't be a jerk. We follow standard open-source norms.

## Questions

Open a discussion or email stephen@botzone.ai.
